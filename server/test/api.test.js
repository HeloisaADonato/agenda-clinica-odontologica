// Testa a API de verdade, com um MongoDB temporário em memória.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import bcrypt from "bcryptjs";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { criarApp } from "../src/app.js";
import { conectar } from "../src/banco.js";

const SEGREDO = "segredo-de-teste-com-mais-de-32-caracteres";
const SENHA = "senha-inicial";
const ORIGEM = "https://heloisaadonato.github.io";

let mongo, cliente, banco, servidor, base;

function subir(opcoes = {}) {
  return new Promise((resolver) => {
    const app = criarApp({ cliente, banco, jwtSegredo: SEGREDO, origens: [ORIGEM], custoHash: 4, limiteLogin: 1000, ...opcoes });
    const instancia = app.listen(0, () => resolver(instancia));
  });
}

async function chamar(metodo, caminho, { token, corpo, url = base, headers = {} } = {}) {
  const resposta = await fetch(`${url}/api${caminho}`, {
    method: metodo,
    headers: {
      ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resposta.text();
  return { status: resposta.status, dados: texto ? JSON.parse(texto) : null, headers: resposta.headers };
}

async function criarUsuario(login, nivel, trocarSenha = false) {
  await banco.collection("usuarios").insertOne({
    nome: login,
    login,
    nivel,
    senhaHash: await bcrypt.hash(SENHA, 4),
    trocarSenha,
    sessaoVersao: 0,
  });
}

async function entrar(login, senha = SENHA) {
  const { dados } = await chamar("POST", "/auth/login", { corpo: { login, senha } });
  return dados.token;
}

let cpfs = 0;
const novoCpf = () => `000.000.${String(++cpfs).padStart(3, "0")}-00`;

before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  ({ cliente, banco } = await conectar(mongo.getUri(), "teste"));
  servidor = await subir();
  base = `http://127.0.0.1:${servidor.address().port}`;
  await criarUsuario("master", "master");
  await criarUsuario("admin", "admin");
  await criarUsuario("novata", "admin", true);
});

after(async () => {
  servidor.close();
  await cliente.close();
  await mongo.stop();
});

describe("login e sessão", () => {
  test("recusa senha errada e usuário inexistente com a mesma mensagem", async () => {
    const errada = await chamar("POST", "/auth/login", { corpo: { login: "master", senha: "x" } });
    const inexistente = await chamar("POST", "/auth/login", { corpo: { login: "ninguem", senha: "x" } });
    assert.equal(errada.status, 401);
    assert.equal(inexistente.status, 401);
    assert.equal(errada.dados.mensagem, inexistente.dados.mensagem);
  });

  test("não aceita objeto no lugar de texto (injeção no MongoDB)", async () => {
    const { status } = await chamar("POST", "/auth/login", { corpo: { login: { $ne: null }, senha: { $ne: null } } });
    assert.equal(status, 400);
  });

  test("login devolve token e nunca o hash", async () => {
    const { status, dados } = await chamar("POST", "/auth/login", { corpo: { login: " MASTER ", senha: SENHA } });
    assert.equal(status, 200);
    assert.ok(dados.token);
    assert.equal(dados.usuario.nivel, "master");
    assert.equal(dados.usuario.senhaHash, undefined);
    assert.equal(dados.usuario.sessaoVersao, undefined);
  });

  test("rotas exigem token válido", async () => {
    assert.equal((await chamar("GET", "/pacientes")).status, 401);
    assert.equal((await chamar("GET", "/pacientes", { token: "invalido" })).status, 401);
    assert.equal((await chamar("GET", "/usuarios")).status, 401);
  });

  test("senha temporária só libera a troca, e a troca devolve token que funciona", async () => {
    const token = await entrar("novata");
    assert.equal((await chamar("GET", "/pacientes", { token })).status, 403);
    assert.equal((await chamar("GET", "/auth/eu", { token })).dados.trocarSenha, true);

    const curta = await chamar("PUT", "/auth/senha", { token, corpo: { senhaAtual: SENHA, novaSenha: "curta" } });
    assert.equal(curta.status, 400);
    const atualErrada = await chamar("PUT", "/auth/senha", { token, corpo: { senhaAtual: "errada-1", novaSenha: "nova-senha-1" } });
    assert.equal(atualErrada.status, 400);
    const igual = await chamar("PUT", "/auth/senha", { token, corpo: { senhaAtual: SENHA, novaSenha: SENHA } });
    assert.equal(igual.status, 400);

    const trocada = await chamar("PUT", "/auth/senha", { token, corpo: { senhaAtual: SENHA, novaSenha: "nova-senha-1" } });
    assert.equal(trocada.status, 200);
    assert.equal(trocada.dados.usuario.trocarSenha, false);
    assert.equal((await chamar("GET", "/pacientes", { token: trocada.dados.token })).status, 200);
    assert.equal((await chamar("GET", "/pacientes", { token })).status, 401, "token antigo deixa de valer");
    assert.equal((await chamar("POST", "/auth/login", { corpo: { login: "novata", senha: SENHA } })).status, 401);
  });

  test("limita tentativas de login", async () => {
    const instancia = await subir({ limiteLogin: 3 });
    const url = `http://127.0.0.1:${instancia.address().port}`;
    const status = [];
    for (let i = 0; i < 5; i++) status.push((await chamar("POST", "/auth/login", { url, corpo: { login: "master", senha: "x" } })).status);
    instancia.close();
    assert.deepEqual(status, [401, 401, 401, 429, 429]);
  });

  test("CORS libera só a origem autorizada", async () => {
    const permitida = await chamar("GET", "/saude", { headers: { Origin: ORIGEM } });
    const outra = await chamar("GET", "/saude", { headers: { Origin: "https://site-qualquer.example" } });
    assert.equal(permitida.headers.get("access-control-allow-origin"), ORIGEM);
    assert.equal(outra.headers.get("access-control-allow-origin"), null);
  });
});

describe("cadastros e permissões", () => {
  test("CRUD de paciente, com CPF normalizado e único", async () => {
    const token = await entrar("admin");
    const corpo = { nome: " Ana ", cpf: "12345678909", telefone: "11", campoExtra: "ignorado" };
    const criado = await chamar("POST", "/pacientes", { token, corpo });
    assert.equal(criado.status, 201);
    assert.equal(typeof criado.dados._id, "string");
    assert.equal(criado.dados.nome, "Ana");
    assert.equal(criado.dados.cpf, "123.456.789-09");
    assert.equal(criado.dados.campoExtra, undefined);

    const repetido = await chamar("POST", "/pacientes", { token, corpo: { ...corpo, cpf: "123.456.789-09" } });
    assert.equal(repetido.status, 409);

    const editado = await chamar("PUT", `/pacientes/${criado.dados._id}`, { token, corpo: { ...corpo, nome: "Ana Maria" } });
    assert.equal(editado.dados.nome, "Ana Maria");
    assert.equal((await chamar("GET", "/pacientes", { token })).dados.filter((p) => p.nome === "Ana Maria").length, 1);
  });

  test("valida campos e ids", async () => {
    const token = await entrar("admin");
    assert.equal((await chamar("POST", "/pacientes", { token, corpo: { nome: "", cpf: "1", telefone: "1" } })).status, 400);
    assert.equal((await chamar("POST", "/procedimentos", { token, corpo: { nome: "X", duracaoMin: 5, valor: 1 } })).status, 400);
    assert.equal((await chamar("POST", "/procedimentos", { token, corpo: { nome: "X", duracaoMin: "30", valor: 1 } })).status, 400);
    assert.equal((await chamar("PUT", "/dentistas/nao-e-id", { token, corpo: { nome: "a", cro: "b", especialidade: "c" } })).status, 404);
    assert.equal((await chamar("GET", "/agendamentos?de=lixo", { token })).status, 400);
  });

  test("admin tradicional não exclui nem gerencia usuários, master sim", async () => {
    const admin = await entrar("admin");
    const master = await entrar("master");
    const { dados: paciente } = await chamar("POST", "/pacientes", { token: admin, corpo: { nome: "B", cpf: novoCpf(), telefone: "1" } });

    assert.equal((await chamar("DELETE", `/pacientes/${paciente._id}`, { token: admin })).status, 403);
    assert.equal((await chamar("GET", "/usuarios", { token: admin })).status, 403);
    assert.equal((await chamar("POST", "/usuarios", { token: admin, corpo: { nome: "x", login: "x", nivel: "master", senha: "12345678" } })).status, 403);
    assert.equal((await chamar("DELETE", `/pacientes/${paciente._id}`, { token: master })).status, 204);
    assert.equal((await chamar("DELETE", `/pacientes/${paciente._id}`, { token: master })).status, 404);
  });

  test("gestão de usuários pelo master", async () => {
    const master = await entrar("master");
    const lista = await chamar("GET", "/usuarios", { token: master });
    assert.ok(lista.dados.every((u) => u.senhaHash === undefined));

    const criado = await chamar("POST", "/usuarios", { token: master, corpo: { nome: "C", login: "pessoa.c", nivel: "admin", senha: "temporaria-1" } });
    assert.equal(criado.status, 201);
    assert.equal(criado.dados.trocarSenha, true);
    assert.equal((await chamar("POST", "/usuarios", { token: master, corpo: { nome: "C", login: "pessoa.c", nivel: "admin", senha: "temporaria-1" } })).status, 409);
    assert.equal((await chamar("POST", "/usuarios", { token: master, corpo: { nome: "C", login: "Com Espaco", nivel: "admin", senha: "temporaria-1" } })).status, 400);
    assert.equal((await chamar("POST", "/usuarios", { token: master, corpo: { nome: "C", login: "semsenha", nivel: "admin" } })).status, 400);

    const tokenC = await entrar("pessoa.c", "temporaria-1");
    const { dados: trocada } = await chamar("PUT", "/auth/senha", { token: tokenC, corpo: { senhaAtual: "temporaria-1", novaSenha: "definitiva-1" } });
    const id = criado.dados._id;

    const semSenha = await chamar("PUT", `/usuarios/${id}`, { token: master, corpo: { nome: "C2", login: "pessoa.c", nivel: "admin" } });
    assert.equal(semSenha.dados.trocarSenha, false, "sem senha no PUT mantém a atual");
    assert.equal((await chamar("GET", "/auth/eu", { token: trocada.token })).status, 200);

    await chamar("PUT", `/usuarios/${id}`, { token: master, corpo: { nome: "C2", login: "pessoa.c", nivel: "admin", senha: "redefinida-1" } });
    assert.equal((await chamar("GET", "/auth/eu", { token: trocada.token })).status, 401, "redefinir derruba a sessão");

    assert.equal((await chamar("DELETE", `/usuarios/${id}`, { token: master })).status, 204);
    assert.equal((await chamar("POST", "/auth/login", { corpo: { login: "pessoa.c", senha: "redefinida-1" } })).status, 401);
  });

  test("protege o último master e impede excluir a si mesmo", async () => {
    const master = await entrar("master");
    const { _id } = (await chamar("GET", "/auth/eu", { token: master })).dados;
    assert.equal((await chamar("PUT", `/usuarios/${_id}`, { token: master, corpo: { nome: "m", login: "master", nivel: "admin" } })).status, 409);
    assert.equal((await chamar("DELETE", `/usuarios/${_id}`, { token: master })).status, 409);
  });

  test("usuário excluído perde o acesso na hora", async () => {
    await criarUsuario("temporario", "admin");
    const token = await entrar("temporario");
    await banco.collection("usuarios").deleteOne({ login: "temporario" });
    assert.equal((await chamar("GET", "/pacientes", { token })).status, 401);
  });
});

describe("agendamentos", () => {
  let token, master, pacienteId, dentistaId, procedimentoId;
  const hora = (h, m = 0) => new Date(Date.UTC(2030, 0, 15, h, m)).toISOString();
  const agendamento = (inicio, fim, extra = {}) => ({ pacienteId, dentistaId, procedimentoId, inicio, fim, status: "agendado", observacoes: "", ...extra });

  before(async () => {
    token = await entrar("admin");
    master = await entrar("master");
    pacienteId = (await chamar("POST", "/pacientes", { token, corpo: { nome: "P", cpf: novoCpf(), telefone: "1" } })).dados._id;
    dentistaId = (await chamar("POST", "/dentistas", { token, corpo: { nome: "D", cro: "1", especialidade: "E" } })).dados._id;
    procedimentoId = (await chamar("POST", "/procedimentos", { token, corpo: { nome: "Pr", duracaoMin: 30, valor: 10 } })).dados._id;
  });

  test("salva, devolve ids como texto e datas ISO, e filtra por período", async () => {
    const criado = await chamar("POST", "/agendamentos", { token, corpo: agendamento(hora(12), hora(13)) });
    assert.equal(criado.status, 201);
    assert.equal(criado.dados.dentistaId, dentistaId);
    assert.equal(criado.dados.inicio, hora(12));

    const dentro = await chamar("GET", `/agendamentos?de=${hora(0)}&ate=${hora(23)}`, { token });
    assert.ok(dentro.dados.some((a) => a._id === criado.dados._id));
    const fora = await chamar("GET", `/agendamentos?de=${hora(13)}&ate=${hora(23)}`, { token });
    assert.ok(!fora.dados.some((a) => a._id === criado.dados._id));
    const dentista = (await chamar("GET", "/dentistas", { token })).dados.find((d) => d._id === dentistaId);
    assert.equal(dentista.versaoAgenda, undefined);
  });

  test("bloqueia sobreposição, aceita horário encostado e ignora cancelados", async () => {
    assert.equal((await chamar("POST", "/agendamentos", { token, corpo: agendamento(hora(12, 30), hora(13, 30)) })).status, 409);
    assert.equal((await chamar("POST", "/agendamentos", { token, corpo: agendamento(hora(13), hora(14)) })).status, 201);
    assert.equal((await chamar("POST", "/agendamentos", { token, corpo: agendamento(hora(12), hora(13), { status: "cancelado" }) })).status, 201);
  });

  test("editar não conflita consigo mesmo, mas conflita com outro", async () => {
    const { dados } = await chamar("POST", "/agendamentos", { token, corpo: agendamento(hora(15), hora(16)) });
    assert.equal((await chamar("PUT", `/agendamentos/${dados._id}`, { token, corpo: agendamento(hora(15), hora(16), { status: "confirmado" }) })).status, 200);
    assert.equal((await chamar("PUT", `/agendamentos/${dados._id}`, { token, corpo: agendamento(hora(12), hora(13)) })).status, 409);
  });

  test("recusa fim antes do início, referências inexistentes e id desconhecido", async () => {
    const fantasma = "507f1f77bcf86cd799439011";
    assert.equal((await chamar("POST", "/agendamentos", { token, corpo: agendamento(hora(18), hora(17)) })).status, 400);
    assert.equal((await chamar("POST", "/agendamentos", { token, corpo: agendamento(hora(18), hora(19), { pacienteId: fantasma }) })).status, 400);
    assert.equal((await chamar("POST", "/agendamentos", { token, corpo: agendamento(hora(18), hora(19), { dentistaId: fantasma }) })).status, 400);
    assert.equal((await chamar("PUT", `/agendamentos/${fantasma}`, { token, corpo: agendamento(hora(18), hora(19)) })).status, 404);
  });

  test("com pedidos simultâneos para o mesmo horário, só um é aceito", async () => {
    const pedidos = Array.from({ length: 12 }, () => chamar("POST", "/agendamentos", { token, corpo: agendamento(hora(20), hora(21)) }));
    const status = (await Promise.all(pedidos)).map((r) => r.status).sort();
    assert.deepEqual(status, [201, ...Array(11).fill(409)]);
  });

  test("exclusão com vínculo é bloqueada, e master exclui agendamento", async () => {
    assert.equal((await chamar("DELETE", `/pacientes/${pacienteId}`, { token: master })).status, 409);
    const { dados } = await chamar("POST", "/agendamentos", { token, corpo: agendamento(hora(22), hora(23)) });
    assert.equal((await chamar("DELETE", `/agendamentos/${dados._id}`, { token })).status, 403);
    assert.equal((await chamar("DELETE", `/agendamentos/${dados._id}`, { token: master })).status, 204);
  });
});
