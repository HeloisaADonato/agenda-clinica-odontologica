// Camada de dados. Toda a comunicação do site passa por window.api, que usa
// o back-end real ou o modo demonstração conforme APP_CONFIG.USE_MOCK.
// O contrato esperado do back-end está em docs/API.md.
(function () {
  const { USE_MOCK, API_BASE_URL } = window.APP_CONFIG;
  const RECURSOS = ["pacientes", "dentistas", "procedimentos", "agendamentos"];

  class ApiError extends Error {
    constructor(mensagem, status) {
      super(mensagem);
      this.status = status;
    }
  }

  async function requisitar(metodo, caminho, corpo) {
    let resposta;
    try {
      resposta = await fetch(`${API_BASE_URL}${caminho}`, {
        method: metodo,
        headers: corpo ? { "Content-Type": "application/json" } : undefined,
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
    } catch {
      throw new ApiError("Não foi possível conectar ao servidor.", 0);
    }
    if (resposta.status === 204) return null;
    const dados = await resposta.json().catch(() => null);
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

  // ---------- Modo demonstração: imita as regras do back-end ----------

  const CHAVE_MOCK = "odonto:mock:v1";
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

  let banco = USE_MOCK ? carregarMock() : null;

  function salvarMock() {
    try {
      localStorage.setItem(CHAVE_MOCK, JSON.stringify(banco));
    } catch {
      // Sem acesso ao armazenamento: as alterações valem até recarregar a página.
    }
  }

  const copiar = (valor) => JSON.parse(JSON.stringify(valor));
  const esperar = () => new Promise((resolver) => setTimeout(resolver, 120));
  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

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
        let itens = banco[recurso];
        if (filtros.de) itens = itens.filter((a) => new Date(a.inicio) >= new Date(filtros.de));
        if (filtros.ate) itens = itens.filter((a) => new Date(a.inicio) < new Date(filtros.ate));
        return copiar(itens);
      },
      async criar(dados) {
        await esperar();
        if (recurso === "agendamentos") validarHorario(dados);
        const item = { ...copiar(dados), _id: novoId() };
        banco[recurso].push(item);
        salvarMock();
        return copiar(item);
      },
      async atualizar(id, dados) {
        await esperar();
        const item = buscar(id);
        if (recurso === "agendamentos") validarHorario(dados, id);
        Object.assign(item, copiar(dados));
        salvarMock();
        return copiar(item);
      },
      async remover(id) {
        await esperar();
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

  const criarCliente = USE_MOCK ? clienteMock : clienteRest;
  window.api = Object.fromEntries(RECURSOS.map((recurso) => [recurso, criarCliente(recurso)]));
  window.api.modoDemo = USE_MOCK;
  window.api.restaurarDemo = function () {
    banco = window.criarDadosMock();
    salvarMock();
  };
})();
