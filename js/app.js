// Interface do site: rotas, agenda e cadastros.
(function () {
  const api = window.api;
  const { HORA_ABERTURA, HORA_FECHAMENTO, INTERVALO_MIN } = window.APP_CONFIG;
  const PX_POR_MIN = 2;

  const STATUS = {
    agendado: "Agendado",
    confirmado: "Confirmado",
    concluido: "Concluído",
    cancelado: "Cancelado",
  };

  const NIVEIS = {
    master: "Admin master",
    admin: "Admin tradicional",
  };

  const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  // ---------- Utilitários ----------

  const $ = (id) => document.getElementById(id);

  function esc(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  const doisDigitos = (n) => String(n).padStart(2, "0");

  function dataParaTexto(data) {
    return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
  }

  const textoParaData = (texto) => new Date(`${texto}T00:00`);

  function somarDias(texto, dias) {
    const data = textoParaData(texto);
    data.setDate(data.getDate() + dias);
    return dataParaTexto(data);
  }

  function hora(valor) {
    const data = new Date(valor);
    return `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`;
  }

  function dataBrasileira(texto) {
    if (!texto) return "";
    const [ano, mes, dia] = texto.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  const porId = (lista) => new Map(lista.map((item) => [item._id, item]));
  const porNome = (a, b) => a.nome.localeCompare(b.nome, "pt-BR");

  function avisar(mensagem, tipo = "") {
    const aviso = document.createElement("div");
    aviso.className = `aviso ${tipo ? `aviso--${tipo}` : ""}`;
    aviso.textContent = mensagem;
    $("avisos").append(aviso);
    setTimeout(() => aviso.remove(), 4000);
  }

  // ---------- Diálogos ----------

  const modal = $("modal");

  function abrirModal({ titulo, corpo, aoSalvar, aoExcluir, aoAbrir }) {
    $("modal-titulo").textContent = titulo;
    $("modal-corpo").innerHTML = corpo;
    $("modal-erro").hidden = true;
    $("modal-excluir").hidden = !aoExcluir;
    $("modal-excluir").onclick = aoExcluir ? () => executar(aoExcluir) : null;

    async function executar(acao) {
      $("modal-salvar").disabled = true;
      $("modal-erro").hidden = true;
      try {
        if ((await acao()) !== false) modal.close();
      } catch (erro) {
        $("modal-erro").textContent = erro.message;
        $("modal-erro").hidden = false;
      } finally {
        $("modal-salvar").disabled = false;
      }
    }

    $("modal-form").onsubmit = (evento) => {
      evento.preventDefault();
      executar(() => aoSalvar(new FormData(evento.target)));
    };

    modal.showModal();
    if (aoAbrir) aoAbrir();
  }

  modal.addEventListener("click", (evento) => {
    if (evento.target.closest("[data-fechar]")) modal.close();
  });

  function confirmar(mensagem) {
    const dialogo = $("confirmacao");
    $("confirmacao-texto").textContent = mensagem;
    dialogo.showModal();
    return new Promise((resolver) => {
      const concluir = (evento, resposta) => {
        evento.preventDefault();
        dialogo.close();
        resolver(resposta);
      };
      dialogo.querySelector("form").onsubmit = (evento) => concluir(evento, evento.submitter.value === "sim");
      dialogo.oncancel = (evento) => concluir(evento, false);
    });
  }

  function campoSelecao(nome, rotulo, opcoes, selecionado, textoVazio) {
    const itens = opcoes
      .map((o) => `<option value="${esc(o.valor)}"${o.valor === selecionado ? " selected" : ""}>${esc(o.rotulo)}</option>`)
      .join("");
    return `<label class="campo"><span>${esc(rotulo)}</span>
      <select name="${nome}" required>
        ${textoVazio ? `<option value="">${esc(textoVazio)}</option>` : ""}${itens}
      </select></label>`;
  }

  // ---------- Agenda ----------

  const agenda = { data: dataParaTexto(new Date()), dentistaId: "", status: "" };

  function cartaoAgendamento(item, estilo = "") {
    return `<button type="button" class="cartao cartao--${esc(item.status)}" data-acao="editar-agendamento" data-id="${esc(item._id)}"${estilo ? ` style="${estilo}"` : ""}>
      <span class="cartao__linha">
        <span class="cartao__hora">${hora(item.inicio)} – ${hora(item.fim)}</span>
        <span class="cartao__status">${esc(STATUS[item.status] ?? item.status)}</span>
      </span>
      <strong class="cartao__paciente">${esc(item.paciente?.nome ?? "Paciente removido")}</strong>
      <span class="cartao__detalhe">${esc(item.procedimento?.nome ?? "Procedimento removido")}</span>
    </button>`;
  }

  function gradeDoDia(dentistas, itens) {
    const totalMin = (HORA_FECHAMENTO - HORA_ABERTURA) * 60;
    const altura = totalMin * PX_POR_MIN;
    const linhaHora = 60 * PX_POR_MIN;

    const horas = [];
    for (let h = HORA_ABERTURA; h < HORA_FECHAMENTO; h++) {
      horas.push(`<span style="height:${linhaHora}px">${doisDigitos(h)}:00</span>`);
    }

    const cabecalhos = dentistas
      .map((d) => `<div class="grade__dentista"><strong>${esc(d.nome)}</strong><span>${esc(d.especialidade)}</span></div>`)
      .join("");

    const colunas = dentistas
      .map((dentista) => {
        const cartoes = itens
          .filter((item) => item.dentistaId === dentista._id)
          .map((item) => {
            const inicio = new Date(item.inicio);
            const minutos = (inicio.getHours() - HORA_ABERTURA) * 60 + inicio.getMinutes();
            const duracao = (new Date(item.fim) - inicio) / 60000;
            return cartaoAgendamento(item, `top:${minutos * PX_POR_MIN}px;height:${duracao * PX_POR_MIN - 2}px`);
          })
          .join("");
        return `<div class="grade__coluna" data-dentista="${esc(dentista._id)}" style="height:${altura}px;--linha:${linhaHora}px">${cartoes}</div>`;
      })
      .join("");

    return `<div class="grade" style="--colunas:${dentistas.length}">
      <div class="grade__interna">
        <div class="grade__canto"></div>${cabecalhos}
        <div class="grade__horas">${horas.join("")}</div>${colunas}
      </div>
    </div>`;
  }

  function listaDoDia(dentistasPorId, itens) {
    return `<ul class="lista-dia">${itens
      .map((item) => {
        const dentista = dentistasPorId.get(item.dentistaId);
        return `<li>${cartaoAgendamento(item)}<span class="lista-dia__dentista">${esc(dentista?.nome ?? "")}</span></li>`;
      })
      .join("")}</ul>`;
  }

  function resumoDoDia(itens) {
    if (!itens.length) return "Nenhum agendamento neste dia";
    const pendentes = itens.filter((i) => i.status === "agendado").length;
    const total = `${itens.length} ${itens.length === 1 ? "agendamento" : "agendamentos"}`;
    if (!pendentes) return total;
    return `${total}, ${pendentes} a confirmar`;
  }

  async function renderizarAgenda(ehAtual) {
    const inicioDia = textoParaData(agenda.data);
    const fimDia = textoParaData(somarDias(agenda.data, 1));

    const [dentistas, pacientes, procedimentos, agendamentos] = await Promise.all([
      api.dentistas.listar(),
      api.pacientes.listar(),
      api.procedimentos.listar(),
      api.agendamentos.listar({ de: inicioDia.toISOString(), ate: fimDia.toISOString() }),
    ]);
    if (!ehAtual()) return;

    const pacientesPorId = porId(pacientes);
    const procedimentosPorId = porId(procedimentos);
    const dentistasPorId = porId(dentistas);

    if (agenda.dentistaId && !dentistasPorId.has(agenda.dentistaId)) agenda.dentistaId = "";

    const itens = agendamentos
      .filter((a) => (agenda.status ? a.status === agenda.status : a.status !== "cancelado"))
      .filter((a) => !agenda.dentistaId || a.dentistaId === agenda.dentistaId)
      .map((a) => ({
        ...a,
        paciente: pacientesPorId.get(a.pacienteId),
        procedimento: procedimentosPorId.get(a.procedimentoId),
      }))
      .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

    const colunas = dentistas
      .filter((d) => !agenda.dentistaId || d._id === agenda.dentistaId)
      .sort(porNome);

    const tituloData = inicioDia.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    const ehHoje = agenda.data === dataParaTexto(new Date());

    const opcoesDentista = [...dentistas]
      .sort(porNome)
      .map((d) => `<option value="${esc(d._id)}"${d._id === agenda.dentistaId ? " selected" : ""}>${esc(d.nome)}</option>`)
      .join("");
    const opcoesStatus = Object.entries(STATUS)
      .map(([valor, rotulo]) => `<option value="${valor}"${valor === agenda.status ? " selected" : ""}>${rotulo}</option>`)
      .join("");

    $("conteudo").innerHTML = `
      <header class="topo">
        <div>
          <h1 class="topo__titulo">${esc(tituloData)}</h1>
          <p class="topo__resumo">${esc(resumoDoDia(itens))}</p>
        </div>
        <button type="button" class="btn btn--primario" data-acao="novo-agendamento">Novo agendamento</button>
      </header>
      <div class="filtros">
        <div class="navegacao-dia">
          <button type="button" class="btn-icone" data-acao="dia-anterior" aria-label="Dia anterior">&lsaquo;</button>
          <button type="button" class="btn" data-acao="hoje"${ehHoje ? " disabled" : ""}>Hoje</button>
          <button type="button" class="btn-icone" data-acao="proximo-dia" aria-label="Próximo dia">&rsaquo;</button>
          <input type="date" id="filtro-data" aria-label="Escolher data" value="${esc(agenda.data)}">
        </div>
        <select id="filtro-dentista" aria-label="Filtrar por dentista">
          <option value="">Todos os dentistas</option>${opcoesDentista}
        </select>
        <select id="filtro-status" aria-label="Filtrar por status">
          <option value="">Agendamentos ativos</option>${opcoesStatus}
        </select>
      </div>
      ${colunas.length
        ? gradeDoDia(colunas, itens)
        : `<p class="vazio">Cadastre um dentista para começar a usar a agenda.</p>`}
      ${itens.length
        ? listaDoDia(dentistasPorId, itens)
        : `<p class="vazio vazio--celular">Nenhum agendamento neste dia.</p>`}
    `;
  }

  async function abrirAgendamento({ agendamento, dentistaId = "", horaInicial = "" } = {}) {
    let dentistas, pacientes, procedimentos;
    try {
      [dentistas, pacientes, procedimentos] = await Promise.all([
        api.dentistas.listar(),
        api.pacientes.listar(),
        api.procedimentos.listar(),
      ]);
    } catch (erro) {
      avisar(erro.message, "erro");
      return;
    }

    const procedimentosPorId = porId(procedimentos);
    const dataInicial = agendamento ? dataParaTexto(new Date(agendamento.inicio)) : agenda.data;
    const horaCampo = agendamento ? hora(agendamento.inicio) : horaInicial;
    const opcoes = (lista) => [...lista].sort(porNome).map((i) => ({ valor: i._id, rotulo: i.nome }));
    const opcoesProcedimento = [...procedimentos]
      .sort(porNome)
      .map((p) => ({ valor: p._id, rotulo: `${p.nome} (${p.duracaoMin} min)` }));
    const opcoesStatus = Object.entries(STATUS).map(([valor, rotulo]) => ({ valor, rotulo }));

    const corpo = `
      ${campoSelecao("pacienteId", "Paciente", opcoes(pacientes), agendamento?.pacienteId, "Selecione")}
      ${campoSelecao("procedimentoId", "Procedimento", opcoesProcedimento, agendamento?.procedimentoId, "Selecione")}
      ${campoSelecao("dentistaId", "Dentista", opcoes(dentistas), agendamento?.dentistaId ?? dentistaId, "Selecione")}
      <div class="campos-lado">
        <label class="campo"><span>Data</span>
          <input type="date" name="data" required value="${esc(dataInicial)}"></label>
        <label class="campo"><span>Horário</span>
          <input type="time" name="hora" required step="300" value="${esc(horaCampo)}"></label>
      </div>
      <p class="previsao" id="previsao"></p>
      ${agendamento ? campoSelecao("status", "Status", opcoesStatus, agendamento.status) : ""}
      <label class="campo"><span>Observações</span>
        <textarea name="observacoes" rows="2">${esc(agendamento?.observacoes)}</textarea></label>
    `;

    function calcularHorario(procedimentoId, data, horario) {
      const procedimento = procedimentosPorId.get(procedimentoId);
      if (!procedimento || !data || !horario) return null;
      const inicio = new Date(`${data}T${horario}`);
      return { inicio, fim: new Date(inicio.getTime() + procedimento.duracaoMin * 60000) };
    }

    function atualizarPrevisao() {
      const form = $("modal-form");
      const horario = calcularHorario(form.procedimentoId.value, form.data.value, form.hora.value);
      $("previsao").textContent = horario ? `Término previsto às ${hora(horario.fim)}` : "";
    }

    abrirModal({
      titulo: agendamento ? "Editar agendamento" : "Novo agendamento",
      corpo,
      aoAbrir() {
        const form = $("modal-form");
        [form.procedimentoId, form.data, form.hora].forEach((campo) => {
          campo.addEventListener("input", atualizarPrevisao);
        });
        atualizarPrevisao();
      },
      async aoSalvar(dados) {
        const { inicio, fim } = calcularHorario(dados.get("procedimentoId"), dados.get("data"), dados.get("hora"));
        const abertura = textoParaData(dados.get("data"));
        abertura.setHours(HORA_ABERTURA);
        const fechamento = textoParaData(dados.get("data"));
        fechamento.setHours(HORA_FECHAMENTO);
        if (inicio < abertura || fim > fechamento) {
          throw new Error(`O atendimento precisa caber entre ${doisDigitos(HORA_ABERTURA)}:00 e ${doisDigitos(HORA_FECHAMENTO)}:00.`);
        }

        const registro = {
          pacienteId: dados.get("pacienteId"),
          procedimentoId: dados.get("procedimentoId"),
          dentistaId: dados.get("dentistaId"),
          inicio: inicio.toISOString(),
          fim: fim.toISOString(),
          status: dados.get("status") ?? "agendado",
          observacoes: dados.get("observacoes").trim(),
        };

        if (agendamento) await api.agendamentos.atualizar(agendamento._id, registro);
        else await api.agendamentos.criar(registro);

        agenda.data = dados.get("data");
        avisar(agendamento ? "Agendamento atualizado." : "Agendamento criado.", "ok");
        renderizar();
      },
      aoExcluir: agendamento && api.pode("excluir")
        ? async () => {
            if (!(await confirmar("Excluir este agendamento? Para manter o histórico, prefira mudar o status para Cancelado."))) return false;
            await api.agendamentos.remover(agendamento._id);
            avisar("Agendamento excluído.", "ok");
            renderizar();
          }
        : null,
    });
  }

  // ---------- Cadastros ----------

  const CADASTROS = {
    pacientes: {
      titulo: "Pacientes",
      singular: "paciente",
      busca: ["nome", "cpf", "telefone", "email"],
      colunas: [
        { campo: "nome", rotulo: "Nome" },
        { campo: "telefone", rotulo: "Telefone" },
        { campo: "email", rotulo: "E-mail" },
        { campo: "dataNascimento", rotulo: "Nascimento", formato: dataBrasileira },
      ],
      campos: [
        { nome: "nome", rotulo: "Nome completo", obrigatorio: true },
        { nome: "cpf", rotulo: "CPF", obrigatorio: true, padrao: "\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}", dica: "000.000.000-00" },
        { nome: "telefone", rotulo: "Telefone", tipo: "tel", obrigatorio: true, dica: "(11) 90000-0000" },
        { nome: "email", rotulo: "E-mail", tipo: "email" },
        { nome: "dataNascimento", rotulo: "Data de nascimento", tipo: "date" },
        { nome: "observacoes", rotulo: "Observações (alergias, condições de saúde)", tipo: "textarea" },
      ],
    },
    procedimentos: {
      titulo: "Procedimentos",
      singular: "procedimento",
      busca: ["nome"],
      colunas: [
        { campo: "nome", rotulo: "Nome" },
        { campo: "duracaoMin", rotulo: "Duração", formato: (v) => `${v} min` },
        { campo: "valor", rotulo: "Valor", formato: (v) => moeda.format(v) },
      ],
      campos: [
        { nome: "nome", rotulo: "Nome", obrigatorio: true },
        { nome: "duracaoMin", rotulo: "Duração (minutos)", tipo: "number", obrigatorio: true, min: 15, passo: 5 },
        { nome: "valor", rotulo: "Valor (R$)", tipo: "number", obrigatorio: true, min: 0, passo: 0.01 },
      ],
    },
    dentistas: {
      titulo: "Dentistas",
      singular: "dentista",
      busca: ["nome", "cro", "especialidade"],
      colunas: [
        { campo: "nome", rotulo: "Nome" },
        { campo: "cro", rotulo: "CRO" },
        { campo: "especialidade", rotulo: "Especialidade" },
      ],
      campos: [
        { nome: "nome", rotulo: "Nome", obrigatorio: true },
        { nome: "cro", rotulo: "CRO", obrigatorio: true, dica: "CRO-SP 00000" },
        { nome: "especialidade", rotulo: "Especialidade", obrigatorio: true },
      ],
    },
    usuarios: {
      titulo: "Usuários",
      singular: "usuário",
      permissao: "gerenciar-usuarios",
      busca: ["nome", "login"],
      colunas: [
        { campo: "nome", rotulo: "Nome" },
        { campo: "login", rotulo: "Usuário" },
        { campo: "nivel", rotulo: "Nível", formato: (v) => NIVEIS[v] ?? v },
      ],
      campos: [
        { nome: "nome", rotulo: "Nome", obrigatorio: true },
        { nome: "login", rotulo: "Usuário (para entrar no sistema)", obrigatorio: true, padrao: "[a-z0-9._\\-]+", dica: "letras minúsculas, sem espaços" },
        {
          nome: "nivel",
          rotulo: "Nível",
          tipo: "select",
          opcoes: Object.entries(NIVEIS).map(([valor, rotulo]) => ({ valor, rotulo })),
          padraoSelecao: "admin",
        },
        {
          nome: "senha",
          rotulo: "Senha temporária",
          rotuloEdicao: "Nova senha temporária (em branco mantém a atual)",
          tipo: "password",
          obrigatorioAoCriar: true,
          tamanhoMinimo: 8,
        },
      ],
    },
  };

  const cadastroAtual = { rota: "", itens: [] };

  function linhasCadastro(config, itens) {
    if (!itens.length) {
      return `<tr><td class="vazio" colspan="${config.colunas.length + 1}">Nenhum registro encontrado.</td></tr>`;
    }
    return itens
      .map((item) => {
        const celulas = config.colunas
          .map(({ campo, rotulo, formato }) => {
            const valor = formato ? formato(item[campo]) : item[campo];
            return `<td data-rotulo="${esc(rotulo)}">${esc(valor) || "–"}</td>`;
          })
          .join("");
        return `<tr>${celulas}<td class="tabela__acoes">
          <button type="button" class="btn btn--pequeno" data-acao="editar-registro" data-id="${esc(item._id)}">Editar</button>
        </td></tr>`;
      })
      .join("");
  }

  function filtrarCadastro(config, termo) {
    const busca = termo.trim().toLocaleLowerCase("pt-BR");
    if (!busca) return cadastroAtual.itens;
    return cadastroAtual.itens.filter((item) =>
      config.busca.some((campo) => String(item[campo] ?? "").toLocaleLowerCase("pt-BR").includes(busca))
    );
  }

  async function renderizarCadastro(rota, ehAtual) {
    const config = CADASTROS[rota];
    const itens = await api[rota].listar();
    if (!ehAtual()) return;

    cadastroAtual.rota = rota;
    cadastroAtual.itens = [...itens].sort(porNome);

    const cabecalho = config.colunas.map((c) => `<th scope="col">${esc(c.rotulo)}</th>`).join("");

    $("conteudo").innerHTML = `
      <header class="topo">
        <div>
          <h1 class="topo__titulo">${esc(config.titulo)}</h1>
          <p class="topo__resumo">${itens.length} ${itens.length === 1 ? "cadastro" : "cadastros"}</p>
        </div>
        <button type="button" class="btn btn--primario" data-acao="novo-registro">Novo ${esc(config.singular)}</button>
      </header>
      <div class="filtros">
        <input type="search" id="busca-cadastro" placeholder="Buscar" aria-label="Buscar ${esc(config.singular)}">
      </div>
      <div class="tabela-area">
        <table class="tabela">
          <thead><tr>${cabecalho}<th scope="col"><span class="oculto">Ações</span></th></tr></thead>
          <tbody id="cadastro-linhas">${linhasCadastro(config, cadastroAtual.itens)}</tbody>
        </table>
      </div>
    `;
  }

  function campoCadastro(campo, item) {
    const valor = item?.[campo.nome] ?? "";
    const obrigatorio = campo.obrigatorio || (campo.obrigatorioAoCriar && !item) ? " required" : "";
    const rotulo = (item && campo.rotuloEdicao) || campo.rotulo;
    if (campo.tipo === "select") {
      return campoSelecao(campo.nome, rotulo, campo.opcoes, valor || campo.padraoSelecao);
    }
    if (campo.tipo === "textarea") {
      return `<label class="campo"><span>${esc(rotulo)}</span>
        <textarea name="${campo.nome}" rows="3"${obrigatorio}>${esc(valor)}</textarea></label>`;
    }
    const extras = [
      campo.padrao ? `pattern="${esc(campo.padrao)}"` : "",
      campo.dica ? `placeholder="${esc(campo.dica)}"` : "",
      campo.min !== undefined ? `min="${campo.min}"` : "",
      campo.passo !== undefined ? `step="${campo.passo}"` : "",
      campo.tamanhoMinimo ? `minlength="${campo.tamanhoMinimo}"` : "",
      campo.tipo === "password" ? `autocomplete="new-password"` : "",
    ].join(" ");
    return `<label class="campo"><span>${esc(rotulo)}</span>
      <input type="${campo.tipo ?? "text"}" name="${campo.nome}" value="${esc(valor)}"${obrigatorio} ${extras}></label>`;
  }

  function podeExcluir(rota, item) {
    if (!item || !api.pode("excluir")) return false;
    return !(rota === "usuarios" && item._id === usuarioLogado._id);
  }

  function abrirRegistro(rota, item) {
    const config = CADASTROS[rota];
    abrirModal({
      titulo: `${item ? "Editar" : "Novo"} ${config.singular}`,
      corpo: config.campos.map((campo) => campoCadastro(campo, item)).join(""),
      async aoSalvar(dados) {
        const registro = {};
        for (const campo of config.campos) {
          if (campo.tipo === "password") {
            if (dados.get(campo.nome)) registro[campo.nome] = dados.get(campo.nome);
            continue;
          }
          const valor = dados.get(campo.nome).trim();
          registro[campo.nome] = campo.tipo === "number" ? Number(valor) : valor;
        }
        if (item) await api[rota].atualizar(item._id, registro);
        else await api[rota].criar(registro);
        if (rota === "usuarios") mostrarSessao(await api.auth.usuarioAtual());
        avisar("Cadastro salvo.", "ok");
        renderizar();
      },
      aoExcluir: podeExcluir(rota, item)
        ? async () => {
            if (!(await confirmar(`Excluir ${item.nome}? Esta ação não pode ser desfeita.`))) return false;
            await api[rota].remover(item._id);
            avisar("Cadastro excluído.", "ok");
            renderizar();
          }
        : null,
    });
  }

  // ---------- Rotas ----------

  let ultimaRenderizacao = 0;
  let rotaExibida = "";

  function rotaAtual() {
    const rota = location.hash.replace("#/", "");
    const config = CADASTROS[rota];
    return config && (!config.permissao || api.pode(config.permissao)) ? rota : "agenda";
  }

  async function renderizar() {
    const id = ++ultimaRenderizacao;
    const ehAtual = () => id === ultimaRenderizacao;
    const rota = rotaAtual();

    document.querySelectorAll("[data-rota]").forEach((link) => {
      if (link.dataset.rota === rota) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.title = `${CADASTROS[rota]?.titulo ?? "Agenda"} | Clínica Odontológica`;

    if (rota !== rotaExibida) {
      rotaExibida = rota;
      $("conteudo").innerHTML = `<p class="vazio">Carregando…</p>`;
    }

    try {
      if (rota === "agenda") await renderizarAgenda(ehAtual);
      else await renderizarCadastro(rota, ehAtual);
    } catch (erro) {
      if (!ehAtual()) return;
      rotaExibida = "";
      $("conteudo").innerHTML = `<div class="vazio">
        <p>${esc(erro.message)}</p>
        <button type="button" class="btn" data-acao="recarregar">Tentar novamente</button>
      </div>`;
    }
  }

  // ---------- Acesso ----------

  let usuarioLogado = null;

  function mostrarSessao(usuario) {
    usuarioLogado = usuario;
    $("sessao-nome").textContent = usuario.nome;
    $("sessao-nivel").textContent = NIVEIS[usuario.nivel] ?? usuario.nivel;
    document.querySelectorAll("[data-permissao]").forEach((elemento) => {
      elemento.hidden = !api.pode(elemento.dataset.permissao);
    });
  }

  function entrarNoApp(usuario) {
    mostrarSessao(usuario);
    $("login").hidden = true;
    $("app").hidden = false;
    renderizar();
  }

  function mostrarAcesso(formulario) {
    usuarioLogado = null;
    [modal, $("confirmacao")].forEach((dialogo) => {
      if (dialogo.open) dialogo.close();
    });
    $("app").hidden = true;
    // Descarta renderizações em andamento para nada voltar à tela depois de sair.
    ultimaRenderizacao++;
    $("conteudo").innerHTML = "";
    rotaExibida = "";
    $("login").hidden = false;
    $("login-erro").hidden = true;
    ["login-form", "troca-form"].forEach((id) => {
      $(id).reset();
      $(id).hidden = id !== formulario;
    });
    $(formulario).querySelector("input").focus();
  }

  function seguir(usuario) {
    if (usuario.trocarSenha) mostrarAcesso("troca-form");
    else entrarNoApp(usuario);
  }

  function camposSenha() {
    return `
      <label class="campo"><span>Senha atual</span>
        <input type="password" name="senhaAtual" required autocomplete="current-password"></label>
      <label class="campo"><span>Nova senha (mínimo de 8 caracteres)</span>
        <input type="password" name="novaSenha" required minlength="8" autocomplete="new-password"></label>
      <label class="campo"><span>Repita a nova senha</span>
        <input type="password" name="confirmacao" required minlength="8" autocomplete="new-password"></label>
    `;
  }

  function trocarSenha(dados) {
    const nova = dados.get("novaSenha");
    if (nova !== dados.get("confirmacao")) throw new Error("As duas senhas novas não são iguais.");
    if (nova === dados.get("senhaAtual")) throw new Error("A nova senha precisa ser diferente da atual.");
    return api.auth.trocarSenha(dados.get("senhaAtual"), nova);
  }

  function aoEnviarAcesso(formulario, acao) {
    formulario.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const botao = formulario.querySelector("[type=submit]");
      botao.disabled = true;
      $("login-erro").hidden = true;
      try {
        seguir(await acao(new FormData(formulario)));
      } catch (erro) {
        $("login-erro").textContent = erro.message;
        $("login-erro").hidden = false;
      } finally {
        botao.disabled = false;
      }
    });
  }

  function sair() {
    api.auth.sair();
    mostrarAcesso("login-form");
  }

  $("troca-campos").innerHTML = camposSenha();
  aoEnviarAcesso($("login-form"), (dados) => api.auth.entrar(dados.get("login"), dados.get("senha")));
  aoEnviarAcesso($("troca-form"), trocarSenha);
  $("troca-sair").addEventListener("click", sair);
  $("sair").addEventListener("click", sair);

  $("alterar-senha").addEventListener("click", () => {
    abrirModal({
      titulo: "Alterar senha",
      corpo: camposSenha(),
      async aoSalvar(dados) {
        await trocarSenha(dados);
        avisar("Senha alterada.", "ok");
      },
    });
  });

  window.addEventListener("sessao-expirada", () => {
    mostrarAcesso("login-form");
    avisar("Sua sessão expirou. Entre novamente.", "erro");
  });

  // ---------- Eventos ----------

  async function buscarAgendamento(id) {
    const inicio = textoParaData(agenda.data);
    const fim = textoParaData(somarDias(agenda.data, 1));
    const lista = await api.agendamentos.listar({ de: inicio.toISOString(), ate: fim.toISOString() });
    return lista.find((a) => a._id === id);
  }

  const ACOES = {
    recarregar: renderizar,
    "novo-agendamento": () => abrirAgendamento(),
    async "editar-agendamento"(botao) {
      try {
        const agendamento = await buscarAgendamento(botao.dataset.id);
        if (agendamento) abrirAgendamento({ agendamento });
      } catch (erro) {
        avisar(erro.message, "erro");
      }
    },
    "dia-anterior"() {
      agenda.data = somarDias(agenda.data, -1);
      renderizar();
    },
    "proximo-dia"() {
      agenda.data = somarDias(agenda.data, 1);
      renderizar();
    },
    hoje() {
      agenda.data = dataParaTexto(new Date());
      renderizar();
    },
    "novo-registro": () => abrirRegistro(cadastroAtual.rota),
    "editar-registro"(botao) {
      abrirRegistro(cadastroAtual.rota, cadastroAtual.itens.find((i) => i._id === botao.dataset.id));
    },
  };

  $("conteudo").addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-acao]");
    if (botao) {
      ACOES[botao.dataset.acao](botao);
      return;
    }

    // Clique em um espaço livre da grade já abre o formulário com dentista e horário.
    const coluna = evento.target.closest(".grade__coluna");
    if (!coluna) return;
    const y = evento.clientY - coluna.getBoundingClientRect().top;
    const minutos = Math.floor(y / PX_POR_MIN / INTERVALO_MIN) * INTERVALO_MIN + HORA_ABERTURA * 60;
    abrirAgendamento({
      dentistaId: coluna.dataset.dentista,
      horaInicial: `${doisDigitos(Math.floor(minutos / 60))}:${doisDigitos(minutos % 60)}`,
    });
  });

  $("conteudo").addEventListener("change", (evento) => {
    const { id, value } = evento.target;
    if (id === "filtro-data" && value) agenda.data = value;
    else if (id === "filtro-dentista") agenda.dentistaId = value;
    else if (id === "filtro-status") agenda.status = value;
    else return;
    renderizar();
  });

  $("conteudo").addEventListener("input", (evento) => {
    if (evento.target.id !== "busca-cadastro") return;
    const config = CADASTROS[cadastroAtual.rota];
    $("cadastro-linhas").innerHTML = linhasCadastro(config, filtrarCadastro(config, evento.target.value));
  });

  window.addEventListener("hashchange", () => {
    if (usuarioLogado) renderizar();
  });

  if (api.modoDemo) {
    $("aviso-demo").hidden = false;
    $("login-demo").hidden = false;
    $("redefinir-demo").addEventListener("click", () => {
      api.restaurarDemo();
      avisar("Dados de demonstração restaurados.", "ok");
      renderizar();
    });
  } else {
    $("login-demo").textContent = "Se o site ficou um tempo sem uso, a primeira resposta pode levar cerca de um minuto.";
    $("login-demo").hidden = false;
  }

  async function iniciar() {
    // O servidor pode demorar a acordar: a tela de login aparece enquanto a sessão é conferida.
    if (!api.modoDemo) mostrarAcesso("login-form");
    let usuario = null;
    try {
      usuario = await api.auth.usuarioAtual();
    } catch {
      // Sem conexão ou sessão inválida: quem decide é a tela de login.
    }
    if (usuario) seguir(usuario);
    else mostrarAcesso("login-form");
  }

  iniciar();
})();
