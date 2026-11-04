// Validação da entrada: só os campos previstos chegam ao banco, sempre com o tipo certo.
import { ObjectId } from "mongodb";

export class ErroApi extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

const invalido = (mensagem) => new ErroApi(400, mensagem);

export function texto(rotulo, { obrigatorio = false, max = 200, padrao } = {}) {
  return (valor) => {
    if (valor === undefined || valor === null) valor = "";
    if (typeof valor !== "string") throw invalido(`${rotulo} inválido.`);
    const limpo = valor.trim();
    if (!limpo) {
      if (obrigatorio) throw invalido(`${rotulo} é obrigatório.`);
      return "";
    }
    if (limpo.length > max || (padrao && !padrao.test(limpo))) throw invalido(`${rotulo} inválido.`);
    return limpo;
  };
}

export function numero(rotulo, { min = 0 } = {}) {
  return (valor) => {
    if (typeof valor !== "number" || !Number.isFinite(valor) || valor < min) throw invalido(`${rotulo} inválido.`);
    return valor;
  };
}

export function dataHora(rotulo) {
  return (valor) => {
    const data = typeof valor === "string" ? new Date(valor) : null;
    if (!data || Number.isNaN(data.getTime())) throw invalido(`${rotulo} inválido.`);
    return data;
  };
}

export function identificador(rotulo) {
  return (valor) => {
    if (typeof valor !== "string" || !ObjectId.isValid(valor)) throw invalido(`${rotulo} inválido.`);
    return new ObjectId(valor);
  };
}

export function opcao(rotulo, opcoes) {
  return (valor) => {
    if (!opcoes.includes(valor)) throw invalido(`${rotulo} inválido.`);
    return valor;
  };
}

// Guarda sempre no formato 000.000.000-00 para o índice único valer com ou sem pontuação.
function cpf(valor) {
  const limpo = texto("CPF", { obrigatorio: true, padrao: /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/ })(valor);
  return limpo.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export const ESQUEMAS = {
  pacientes: {
    nome: texto("Nome", { obrigatorio: true }),
    cpf,
    telefone: texto("Telefone", { obrigatorio: true, max: 30 }),
    email: texto("E-mail"),
    dataNascimento: texto("Data de nascimento", { padrao: /^\d{4}-\d{2}-\d{2}$/ }),
    observacoes: texto("Observações", { max: 2000 }),
  },
  dentistas: {
    nome: texto("Nome", { obrigatorio: true }),
    cro: texto("CRO", { obrigatorio: true, max: 40 }),
    especialidade: texto("Especialidade", { obrigatorio: true }),
  },
  procedimentos: {
    nome: texto("Nome", { obrigatorio: true }),
    duracaoMin: numero("Duração", { min: 15 }),
    valor: numero("Valor"),
  },
  agendamentos: {
    pacienteId: identificador("Paciente"),
    dentistaId: identificador("Dentista"),
    procedimentoId: identificador("Procedimento"),
    inicio: dataHora("Início"),
    fim: dataHora("Fim"),
    status: opcao("Status", ["agendado", "confirmado", "concluido", "cancelado"]),
    observacoes: texto("Observações", { max: 2000 }),
  },
  usuarios: {
    nome: texto("Nome", { obrigatorio: true }),
    login: texto("Usuário", { obrigatorio: true, max: 60, padrao: /^[a-z0-9._-]+$/ }),
    nivel: opcao("Nível", ["master", "admin"]),
  },
};

export function validar(esquema, corpo) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) throw invalido("Dados inválidos.");
  return Object.fromEntries(Object.entries(esquema).map(([campo, validador]) => [campo, validador(corpo[campo])]));
}

// O bcrypt considera só os primeiros 72 bytes da senha.
export function validarSenha(senha) {
  if (typeof senha !== "string" || senha.length < 8 || Buffer.byteLength(senha) > 72) {
    throw invalido("A senha precisa ter de 8 a 72 caracteres.");
  }
  return senha;
}
