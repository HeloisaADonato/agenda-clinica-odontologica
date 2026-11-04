// Prepara o banco: cria índices e os usuários iniciais com senhas temporárias aleatórias.
// As senhas vão só para server/senhas-iniciais.txt, que o git ignora.
// Com --demo também cria dentistas, procedimentos, pacientes e agendamentos fictícios.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import vm from "node:vm";
import { ObjectId } from "mongodb";
import { conectar } from "./banco.js";

const USUARIOS = [
  { nome: "Heloisa Arfelli Donato", login: "heloisa", nivel: "master" },
  { nome: "Sabrina Arfelli", login: "sabrina", nivel: "admin" },
  { nome: "Gabriel", login: "gabriel", nivel: "admin" },
  { nome: "Thiago", login: "thiago", nivel: "admin" },
  { nome: "Guilherme", login: "guilherme", nivel: "admin" },
  { nome: "Isabela", login: "isabela", nivel: "admin" },
];

const ARQUIVO_SENHAS = new URL("../senhas-iniciais.txt", import.meta.url);
const ALFABETO = "abcdefghijkmnpqrstuvwxyz23456789";

function gerarSenha() {
  const letras = Array.from(randomBytes(16), (byte) => ALFABETO[byte % 32]).join("");
  return letras.match(/.{4}/g).join("-");
}

async function criarUsuarios(banco) {
  let criados = 0;
  for (const usuario of USUARIOS) {
    if (await banco.collection("usuarios").findOne({ login: usuario.login })) continue;
    const senha = gerarSenha();
    await banco.collection("usuarios").insertOne({
      ...usuario,
      senhaHash: await bcrypt.hash(senha, 12),
      trocarSenha: true,
      sessaoVersao: 0,
    });
    appendFileSync(ARQUIVO_SENHAS, `${usuario.login.padEnd(10)} ${senha}\n`);
    criados++;
  }
  console.log(`Usuários criados: ${criados}. Já existiam: ${USUARIOS.length - criados}.`);
}

// Reaproveita os dados fictícios do site, trocando os ids de texto por ObjectId.
async function criarDemo(banco) {
  if (await banco.collection("dentistas").findOne()) {
    console.log("O banco já tem dentistas: dados fictícios não foram criados.");
    return;
  }
  const contexto = { window: {} };
  vm.runInNewContext(readFileSync(new URL("../../js/mock-data.js", import.meta.url), "utf8"), contexto);
  const dados = JSON.parse(JSON.stringify(contexto.window.criarDadosMock()));

  const ids = new Map();
  const comObjectId = ({ _id, ...resto }) => {
    ids.set(_id, new ObjectId());
    return { ...resto, _id: ids.get(_id) };
  };
  for (const recurso of ["dentistas", "procedimentos", "pacientes"]) {
    await banco.collection(recurso).insertMany(dados[recurso].map(comObjectId));
  }
  await banco.collection("agendamentos").insertMany(
    dados.agendamentos.map(({ _id, ...a }) => ({
      ...a,
      pacienteId: ids.get(a.pacienteId),
      dentistaId: ids.get(a.dentistaId),
      procedimentoId: ids.get(a.procedimentoId),
      inicio: new Date(a.inicio),
      fim: new Date(a.fim),
    }))
  );
  console.log("Dados fictícios criados.");
}

const { MONGODB_URI, MONGODB_BANCO = "clinica" } = process.env;
if (!MONGODB_URI) throw new Error("Defina MONGODB_URI em server/.env (veja server/.env.example).");

const { cliente, banco } = await conectar(MONGODB_URI, MONGODB_BANCO);
try {
  await criarUsuarios(banco);
  if (process.argv.includes("--demo")) await criarDemo(banco);
} finally {
  await cliente.close();
}
