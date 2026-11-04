// API da clínica. O contrato está em docs/API.md.
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { ErroApi, ESQUEMAS, validar, validarSenha } from "./validacao.js";

const REFERENCIAS = { pacientes: "pacienteId", dentistas: "dentistaId", procedimentos: "procedimentoId" };
const CAMPOS_INTERNOS = ["senhaHash", "sessaoVersao", "versaoAgenda"];
const SESSAO_EXPIRADA = "Sua sessão expirou. Entre novamente.";

function paraJson(documento) {
  const saida = {};
  for (const [campo, valor] of Object.entries(documento)) {
    if (CAMPOS_INTERNOS.includes(campo)) continue;
    if (valor instanceof ObjectId) saida[campo] = valor.toString();
    else if (valor instanceof Date) saida[campo] = valor.toISOString();
    else saida[campo] = valor;
  }
  return saida;
}

function idDaRota(req) {
  if (!ObjectId.isValid(req.params.id)) throw new ErroApi(404, "Registro não encontrado.");
  return new ObjectId(req.params.id);
}

export function criarApp({ cliente, banco, jwtSegredo, origens, custoHash = 12, limiteLogin = 10 }) {
  const app = express();
  const colecao = (nome) => banco.collection(nome);
  const hashFalso = bcrypt.hashSync("usuario-inexistente", custoHash);

  // A API fica atrás de um único proxy na hospedagem; sem isso o limite de login veria um só IP.
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: origens }));
  app.use(express.json({ limit: "100kb" }));

  const emitirToken = (usuario) =>
    jwt.sign({ sub: usuario._id.toString(), v: usuario.sessaoVersao }, jwtSegredo, { algorithm: "HS256", expiresIn: "8h" });

  function exigirMaster(req, res, next) {
    if (req.usuario.nivel !== "master") throw new ErroApi(403, "Você não tem permissão para esta ação.");
    next();
  }

  // ---------- Rotas públicas ----------

  app.get("/api/saude", async (req, res) => {
    await banco.command({ ping: 1 });
    res.json({ ok: true });
  });

  const limitarLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: limiteLogin,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { mensagem: "Muitas tentativas de login. Tente de novo em 15 minutos." },
  });

  app.post("/api/auth/login", limitarLogin, async (req, res) => {
    const { login, senha } = req.body ?? {};
    if (typeof login !== "string" || typeof senha !== "string") throw new ErroApi(400, "Informe usuário e senha.");
    const usuario = await colecao("usuarios").findOne({ login: login.trim().toLowerCase() });
    const confere = await bcrypt.compare(senha, usuario?.senhaHash ?? hashFalso);
    if (!usuario || !confere) throw new ErroApi(401, "Usuário ou senha incorretos.");
    res.json({ token: emitirToken(usuario), usuario: paraJson(usuario) });
  });

  // ---------- Sessão ----------

  // O usuário é lido do banco a cada chamada: nível alterado ou conta excluída valem na hora.
  app.use("/api", async (req, res, next) => {
    const [tipo, token] = (req.headers.authorization ?? "").split(" ");
    if (tipo !== "Bearer" || !token) throw new ErroApi(401, SESSAO_EXPIRADA);
    let dados;
    try {
      dados = jwt.verify(token, jwtSegredo, { algorithms: ["HS256"] });
    } catch {
      throw new ErroApi(401, SESSAO_EXPIRADA);
    }
    const usuario = await colecao("usuarios").findOne({ _id: new ObjectId(dados.sub) });
    if (!usuario || usuario.sessaoVersao !== dados.v) throw new ErroApi(401, SESSAO_EXPIRADA);
    req.usuario = usuario;
    next();
  });

  app.get("/api/auth/eu", (req, res) => res.json(paraJson(req.usuario)));

  app.put("/api/auth/senha", async (req, res) => {
    const { senhaAtual, novaSenha } = req.body ?? {};
    validarSenha(novaSenha);
    if (typeof senhaAtual !== "string" || !(await bcrypt.compare(senhaAtual, req.usuario.senhaHash))) {
      throw new ErroApi(400, "A senha atual está incorreta.");
    }
    if (novaSenha === senhaAtual) throw new ErroApi(400, "A nova senha precisa ser diferente da atual.");
    // Mudar a versão derruba as sessões antigas, por isso a resposta traz um token novo.
    const usuario = await colecao("usuarios").findOneAndUpdate(
      { _id: req.usuario._id },
      { $set: { senhaHash: await bcrypt.hash(novaSenha, custoHash), trocarSenha: false }, $inc: { sessaoVersao: 1 } },
      { returnDocument: "after" }
    );
    res.json({ token: emitirToken(usuario), usuario: paraJson(usuario) });
  });

  app.use("/api", (req, res, next) => {
    if (req.usuario.trocarSenha) throw new ErroApi(403, "Troque sua senha temporária para continuar.");
    next();
  });

  // ---------- Pacientes, dentistas e procedimentos ----------

  for (const recurso of ["pacientes", "dentistas", "procedimentos"]) {
    app.get(`/api/${recurso}`, async (req, res) => {
      res.json((await colecao(recurso).find().toArray()).map(paraJson));
    });

    app.post(`/api/${recurso}`, async (req, res) => {
      const dados = validar(ESQUEMAS[recurso], req.body);
      const { insertedId } = await colecao(recurso).insertOne(dados);
      res.status(201).json(paraJson({ ...dados, _id: insertedId }));
    });

    app.put(`/api/${recurso}/:id`, async (req, res) => {
      const dados = validar(ESQUEMAS[recurso], req.body);
      const item = await colecao(recurso).findOneAndUpdate({ _id: idDaRota(req) }, { $set: dados }, { returnDocument: "after" });
      if (!item) throw new ErroApi(404, "Registro não encontrado.");
      res.json(paraJson(item));
    });

    app.delete(`/api/${recurso}/:id`, exigirMaster, async (req, res) => {
      const id = idDaRota(req);
      const vinculado = await colecao("agendamentos").findOne({ [REFERENCIAS[recurso]]: id, status: { $ne: "cancelado" } });
      if (vinculado) throw new ErroApi(409, "Não é possível excluir: existem agendamentos vinculados.");
      const { deletedCount } = await colecao(recurso).deleteOne({ _id: id });
      if (!deletedCount) throw new ErroApi(404, "Registro não encontrado.");
      res.status(204).end();
    });
  }

  // ---------- Agendamentos ----------

  // Duas pessoas podem pedir o mesmo horário ao mesmo tempo. A escrita no dentista faz as
  // transações dele acontecerem uma de cada vez, e a segunda já enxerga a primeira.
  async function salvarAgendamento(dados, id) {
    if (dados.fim <= dados.inicio) throw new ErroApi(400, "O horário de término precisa ser depois do início.");
    return cliente.withSession((session) =>
      session.withTransaction(async () => {
        const dentista = await colecao("dentistas").findOneAndUpdate(
          { _id: dados.dentistaId },
          { $inc: { versaoAgenda: 1 } },
          { session }
        );
        if (!dentista) throw new ErroApi(400, "Dentista inválido.");
        if (!(await colecao("pacientes").findOne({ _id: dados.pacienteId }, { session }))) throw new ErroApi(400, "Paciente inválido.");
        if (!(await colecao("procedimentos").findOne({ _id: dados.procedimentoId }, { session }))) throw new ErroApi(400, "Procedimento inválido.");

        if (dados.status !== "cancelado") {
          const conflito = await colecao("agendamentos").findOne(
            {
              ...(id ? { _id: { $ne: id } } : {}),
              dentistaId: dados.dentistaId,
              status: { $ne: "cancelado" },
              inicio: { $lt: dados.fim },
              fim: { $gt: dados.inicio },
            },
            { session }
          );
          if (conflito) throw new ErroApi(409, "Este dentista já tem um agendamento nesse horário.");
        }

        if (!id) {
          const { insertedId } = await colecao("agendamentos").insertOne({ ...dados }, { session });
          return { ...dados, _id: insertedId };
        }
        const item = await colecao("agendamentos").findOneAndUpdate({ _id: id }, { $set: dados }, { session, returnDocument: "after" });
        if (!item) throw new ErroApi(404, "Registro não encontrado.");
        return item;
      })
    );
  }

  app.get("/api/agendamentos", async (req, res) => {
    const filtro = {};
    for (const [parametro, operador] of [["de", "$gte"], ["ate", "$lt"]]) {
      if (req.query[parametro] === undefined) continue;
      const data = typeof req.query[parametro] === "string" ? new Date(req.query[parametro]) : null;
      if (!data || Number.isNaN(data.getTime())) throw new ErroApi(400, "Período inválido.");
      filtro.inicio = { ...filtro.inicio, [operador]: data };
    }
    res.json((await colecao("agendamentos").find(filtro).toArray()).map(paraJson));
  });

  app.post("/api/agendamentos", async (req, res) => {
    res.status(201).json(paraJson(await salvarAgendamento(validar(ESQUEMAS.agendamentos, req.body))));
  });

  app.put("/api/agendamentos/:id", async (req, res) => {
    const id = idDaRota(req);
    res.json(paraJson(await salvarAgendamento(validar(ESQUEMAS.agendamentos, req.body), id)));
  });

  app.delete("/api/agendamentos/:id", exigirMaster, async (req, res) => {
    const { deletedCount } = await colecao("agendamentos").deleteOne({ _id: idDaRota(req) });
    if (!deletedCount) throw new ErroApi(404, "Registro não encontrado.");
    res.status(204).end();
  });

  // ---------- Usuários ----------

  app.use("/api/usuarios", exigirMaster);

  app.get("/api/usuarios", async (req, res) => {
    res.json((await colecao("usuarios").find().toArray()).map(paraJson));
  });

  app.post("/api/usuarios", async (req, res) => {
    const dados = validar(ESQUEMAS.usuarios, req.body);
    const senhaHash = await bcrypt.hash(validarSenha(req.body.senha), custoHash);
    const usuario = { ...dados, senhaHash, trocarSenha: true, sessaoVersao: 0 };
    const { insertedId } = await colecao("usuarios").insertOne({ ...usuario });
    res.status(201).json(paraJson({ ...usuario, _id: insertedId }));
  });

  app.put("/api/usuarios/:id", async (req, res) => {
    const id = idDaRota(req);
    const dados = validar(ESQUEMAS.usuarios, req.body);
    const atual = await colecao("usuarios").findOne({ _id: id });
    if (!atual) throw new ErroApi(404, "Registro não encontrado.");
    if (atual.nivel === "master" && dados.nivel !== "master" && (await colecao("usuarios").countDocuments({ nivel: "master" })) === 1) {
      throw new ErroApi(409, "O sistema precisa de pelo menos um admin master.");
    }
    const alteracao = { $set: dados };
    if (req.body.senha) {
      alteracao.$set.senhaHash = await bcrypt.hash(validarSenha(req.body.senha), custoHash);
      alteracao.$set.trocarSenha = true;
      alteracao.$inc = { sessaoVersao: 1 };
    }
    res.json(paraJson(await colecao("usuarios").findOneAndUpdate({ _id: id }, alteracao, { returnDocument: "after" })));
  });

  app.delete("/api/usuarios/:id", async (req, res) => {
    const id = idDaRota(req);
    if (id.equals(req.usuario._id)) throw new ErroApi(409, "Você não pode excluir o próprio usuário.");
    const { deletedCount } = await colecao("usuarios").deleteOne({ _id: id });
    if (!deletedCount) throw new ErroApi(404, "Registro não encontrado.");
    res.status(204).end();
  });

  // ---------- Erros ----------

  app.use("/api", () => {
    throw new ErroApi(404, "Rota não encontrada.");
  });

  app.use((erro, req, res, next) => {
    if (erro instanceof ErroApi) return res.status(erro.status).json({ mensagem: erro.message });
    if (erro.code === 11000) {
      const mensagem = erro.keyPattern?.cpf ? "Já existe um paciente com esse CPF." : "Já existe um usuário com esse login.";
      return res.status(409).json({ mensagem });
    }
    if (erro.status >= 400 && erro.status < 500) return res.status(erro.status).json({ mensagem: "Dados inválidos." });
    console.error(erro);
    res.status(500).json({ mensagem: "Erro ao processar a solicitação." });
  });

  return app;
}
