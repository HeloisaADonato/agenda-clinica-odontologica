// Camada de dados. Toda a comunicação do site passa por window.api, que usa
// o back-end real ou o modo demonstração conforme APP_CONFIG.USE_MOCK.
// O contrato esperado do back-end está em docs/API.md.
(function () {
  const { USE_MOCK, API_BASE_URL } = window.APP_CONFIG;
  const RECURSOS = ["pacientes", "dentistas", "procedimentos", "agendamentos", "usuarios"];

  // O que cada nível pode fazer além de ver, criar e editar agenda e cadastros.
  // No navegador isso só controla a tela: quem protege os dados é o back-end.
  const PERMISSOES = {
    master: ["excluir", "gerenciar-usuarios", "restaurar-dados"],
    admin: [],
  };

  class ApiError extends Error {
    constructor(mensagem, status) {
      super(mensagem);
      this.status = status;
    }
  }

  // ---------- Sessão ----------

  const CHAVE_SESSAO = "odonto:sessao:v1";

  function lerToken() {
    try {
      return sessionStorage.getItem(CHAVE_SESSAO);
    } catch {
      return null;
    }
  }

  let token = lerToken();
  let usuarioLogado = null;

  function abrirSessao(novoToken, usuario) {
    token = novoToken;
    usuarioLogado = usuario;
    try {
      sessionStorage.setItem(CHAVE_SESSAO, novoToken);
    } catch {
      // Sem acesso ao armazenamento: a sessão vale até recarregar a página.
    }
    return usuario;
  }

  function limparSessao() {
    token = null;
    usuarioLogado = null;
    try {
      sessionStorage.removeItem(CHAVE_SESSAO);
    } catch {
      // Sem acesso ao armazenamento: não há nada salvo para remover.
    }
  }

  function sessaoExpirada() {
    limparSessao();
    window.dispatchEvent(new Event("sessao-expirada"));
  }

  // ---------- Back-end real ----------

  async function requisitar(metodo, caminho, corpo) {
    const headers = {};
    if (corpo) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    let resposta;
    try {
      resposta = await fetch(`${API_BASE_URL}${caminho}`, {
        method: metodo,
        headers,
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
    } catch {
      throw new ApiError("Não foi possível conectar ao servidor.", 0);
    }
    if (resposta.status === 204) return null;
    const dados = await resposta.json().catch(() => null);
    if (resposta.status === 401 && token) sessaoExpirada();
    if (!resposta.ok) {
      throw new ApiError(dados?.mensagem || "Erro ao processar a solicitação.", resposta.status);
    }
    return dados;
  }

  function clienteRest(recurso) {
    return {
      listar(filtros = {}) {
        const consulta = new URLSearchParams(filtros).toString();
        return requisitar("GET", `/${recurso}${consulta ? `?${consulta}` : ""}`);
      },
      criar: (dados) => requisitar("POST", `/${recurso}`, dados),
      atualizar: (id, dados) => requisitar("PUT", `/${recurso}/${encodeURIComponent(id)}`, dados),
      remover: (id) => requisitar("DELETE", `/${recurso}/${encodeURIComponent(id)}`),
    };
  }

  const authRest = {
    async entrar(login, senha) {
      const resposta = await requisitar("POST", "/auth/login", { login, senha });
      return abrirSessao(resposta.token, resposta.usuario);
    },
    async usuarioAtual() {
      if (!token) return null;
      usuarioLogado = await requisitar("GET", "/auth/eu");
      return usuarioLogado;
    },
    async trocarSenha(senhaAtual, novaSenha) {
      const resposta = await requisitar("PUT", "/auth/senha", { senhaAtual, novaSenha });
      return abrirSessao(resposta.token, resposta.usuario);
    },
  };

  // ---------- Modo demonstração: imita as regras do back-end ----------

  const CHAVE_MOCK = "odonto:mock:v1";
  const CHAVE_USUARIOS = "odonto:usuarios:v1";
  const ITERACOES_HASH = 600000;
  const REFERENCIAS = { pacientes: "pacienteId", dentistas: "dentistaId", procedimentos: "procedimentoId" };

  function carregarMock() {
    try {
      const salvo = localStorage.getItem(CHAVE_MOCK);
      if (salvo) return JSON.parse(salvo);
    } catch {
      // Sem acesso ao armazenamento: segue com os dados iniciais em memória.
    }
    return window.criarDadosMock();
  }

  function carregarUsuarios() {
    try {
      const salvo = localStorage.getItem(CHAVE_USUARIOS);
      if (salvo) return JSON.parse(salvo);
    } catch {
      // Sem acesso ao armazenamento: segue com os usuários iniciais em memória.
    }
    return window.criarUsuariosMock();
  }

  let banco = USE_MOCK ? carregarMock() : null;
  const usuarios = USE_MOCK ? carregarUsuarios() : [];

  function salvarMock() {
    try {
      localStorage.setItem(CHAVE_MOCK, JSON.stringify(banco));
    } catch {
      // Sem acesso ao armazenamento: as alterações valem até recarregar a página.
    }
  }

  function salvarUsuarios() {
    try {
      localStorage.setItem(CHAVE_USUARIOS, JSON.stringify(usuarios));
    } catch {
      // Sem acesso ao armazenamento: as alterações valem até recarregar a página.
    }
  }

  const copiar = (valor) => JSON.parse(JSON.stringify(valor));
  const esperar = () => new Promise((resolver) => setTimeout(resolver, 120));
  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const paraBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const deBase64 = (texto) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));

  function semSenha({ senha, ...usuario }) {
    return copiar(usuario);
  }

  async function derivarHash(senha, sal, iteracoes) {
    if (!crypto.subtle) throw new ApiError("Abra o site por https ou localhost para usar o login.", 0);
    const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iteracoes }, chave, 256);
    return paraBase64(bits);
  }

  async function gerarHash(senha) {
    const sal = crypto.getRandomValues(new Uint8Array(16));
    return `pbkdf2$${ITERACOES_HASH}$${paraBase64(sal)}$${await derivarHash(senha, sal, ITERACOES_HASH)}`;
  }

  async function senhaConfere(senha, salvo) {
    const [, iteracoes, sal, hash] = salvo.split("$");
    return (await derivarHash(senha, deBase64(sal), Number(iteracoes))) === hash;
  }

  // Equivale ao middleware de autenticação do back-end: confere sessão e nível.
  function exigir(permissao) {
    const usuario = usuarios.find((u) => u._id === token);
    if (!usuario) {
      sessaoExpirada();
      throw new ApiError("Sua sessão expirou. Entre novamente.", 401);
    }
    if (usuario.trocarSenha) throw new ApiError("Troque sua senha temporária para continuar.", 403);
    if (permissao && !PERMISSOES[usuario.nivel].includes(permissao)) {
      throw new ApiError("Você não tem permissão para esta ação.", 403);
    }
    return usuario;
  }

  function validarHorario(dados, idAtual) {
    if (dados.status === "cancelado") return;
    const inicio = new Date(dados.inicio);
    const fim = new Date(dados.fim);
    const conflito = banco.agendamentos.some(
      (a) =>
        a._id !== idAtual &&
        a.dentistaId === dados.dentistaId &&
        a.status !== "cancelado" &&
        new Date(a.inicio) < fim &&
        new Date(a.fim) > inicio
    );
    if (conflito) throw new ApiError("Este dentista já tem um agendamento nesse horário.", 409);
  }

  function clienteMock(recurso) {
    const buscar = (id) => {
      const item = banco[recurso].find((registro) => registro._id === id);
      if (!item) throw new ApiError("Registro não encontrado.", 404);
      return item;
    };

    return {
      async listar(filtros = {}) {
        await esperar();
        exigir();
        let itens = banco[recurso];
        if (filtros.de) itens = itens.filter((a) => new Date(a.inicio) >= new Date(filtros.de));
        if (filtros.ate) itens = itens.filter((a) => new Date(a.inicio) < new Date(filtros.ate));
        return copiar(itens);
      },
      async criar(dados) {
        await esperar();
        exigir();
        if (recurso === "agendamentos") validarHorario(dados);
        const item = { ...copiar(dados), _id: novoId() };
        banco[recurso].push(item);
        salvarMock();
        return copiar(item);
      },
      async atualizar(id, dados) {
        await esperar();
        exigir();
        const item = buscar(id);
        if (recurso === "agendamentos") validarHorario(dados, id);
        Object.assign(item, copiar(dados));
        salvarMock();
        return copiar(item);
      },
      async remover(id) {
        await esperar();
        exigir("excluir");
        buscar(id);
        const campo = REFERENCIAS[recurso];
        if (campo && banco.agendamentos.some((a) => a[campo] === id && a.status !== "cancelado")) {
          throw new ApiError("Não é possível excluir: existem agendamentos vinculados.", 409);
        }
        banco[recurso] = banco[recurso].filter((registro) => registro._id !== id);
        salvarMock();
        return null;
      },
    };
  }

  function clienteUsuariosMock() {
    const buscar = (id) => {
      const item = usuarios.find((usuario) => usuario._id === id);
      if (!item) throw new ApiError("Registro não encontrado.", 404);
      return item;
    };

    const validarLogin = (login, idAtual) => {
      if (usuarios.some((u) => u._id !== idAtual && u.login === login)) {
        throw new ApiError("Já existe um usuário com esse login.", 409);
      }
    };

    return {
      async listar() {
        await esperar();
        exigir("gerenciar-usuarios");
        return usuarios.map(semSenha);
      },
      async criar({ senha, ...dados }) {
        await esperar();
        exigir("gerenciar-usuarios");
        validarLogin(dados.login);
        const item = { ...copiar(dados), _id: novoId(), senha: await gerarHash(senha), trocarSenha: true };
        usuarios.push(item);
        salvarUsuarios();
        return semSenha(item);
      },
      async atualizar(id, { senha, ...dados }) {
        await esperar();
        exigir("gerenciar-usuarios");
        const item = buscar(id);
        validarLogin(dados.login, id);
        const ultimoMaster = item.nivel === "master" && usuarios.filter((u) => u.nivel === "master").length === 1;
        if (ultimoMaster && dados.nivel !== "master") {
          throw new ApiError("O sistema precisa de pelo menos um admin master.", 409);
        }
        Object.assign(item, copiar(dados));
        if (senha) {
          item.senha = await gerarHash(senha);
          item.trocarSenha = true;
        }
        salvarUsuarios();
        return semSenha(item);
      },
      async remover(id) {
        await esperar();
        const atual = exigir("gerenciar-usuarios");
        const item = buscar(id);
        if (item._id === atual._id) throw new ApiError("Você não pode excluir o próprio usuário.", 409);
        usuarios.splice(usuarios.indexOf(item), 1);
        salvarUsuarios();
        return null;
      },
    };
  }

  const authMock = {
    async entrar(login, senha) {
      await esperar();
      const usuario = usuarios.find((u) => u.login === login.trim().toLowerCase());
      if (!usuario || !(await senhaConfere(senha, usuario.senha))) {
        throw new ApiError("Usuário ou senha incorretos.", 401);
      }
      return abrirSessao(usuario._id, semSenha(usuario));
    },
    async usuarioAtual() {
      const usuario = usuarios.find((u) => u._id === token);
      usuarioLogado = usuario ? semSenha(usuario) : null;
      return usuarioLogado;
    },
    async trocarSenha(senhaAtual, novaSenha) {
      await esperar();
      const usuario = usuarios.find((u) => u._id === token);
      if (!usuario) {
        sessaoExpirada();
        throw new ApiError("Sua sessão expirou. Entre novamente.", 401);
      }
      if (!(await senhaConfere(senhaAtual, usuario.senha))) throw new ApiError("A senha atual está incorreta.", 400);
      usuario.senha = await gerarHash(novaSenha);
      usuario.trocarSenha = false;
      salvarUsuarios();
      usuarioLogado = semSenha(usuario);
      return usuarioLogado;
    },
  };

  const criarClienteMock = (recurso) => (recurso === "usuarios" ? clienteUsuariosMock() : clienteMock(recurso));
  const criarCliente = USE_MOCK ? criarClienteMock : clienteRest;
  window.api = Object.fromEntries(RECURSOS.map((recurso) => [recurso, criarCliente(recurso)]));
  window.api.auth = { ...(USE_MOCK ? authMock : authRest), sair: limparSessao };
  window.api.pode = (permissao) => Boolean(PERMISSOES[usuarioLogado?.nivel]?.includes(permissao));
  window.api.modoDemo = USE_MOCK;
  window.api.restaurarDemo = function () {
    exigir("restaurar-dados");
    banco = window.criarDadosMock();
    salvarMock();
  };
})();
