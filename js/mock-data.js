// Dados fictícios do modo demonstração. As datas são relativas ao dia atual
// para a agenda sempre abrir preenchida. Nenhum dado aqui é de pessoa real.
window.criarDadosMock = function () {
  const dentistas = [
    { _id: "den1", nome: "Dra. Marina Teixeira", cro: "CRO-SP 10234", especialidade: "Clínica geral" },
    { _id: "den2", nome: "Dr. Rafael Nogueira", cro: "CRO-SP 20871", especialidade: "Endodontia" },
    { _id: "den3", nome: "Dra. Camila Duarte", cro: "CRO-SP 31590", especialidade: "Ortodontia" },
  ];

  const procedimentos = [
    { _id: "pro1", nome: "Limpeza (profilaxia)", duracaoMin: 45, valor: 180 },
    { _id: "pro2", nome: "Avaliação inicial", duracaoMin: 30, valor: 100 },
    { _id: "pro3", nome: "Restauração", duracaoMin: 60, valor: 280 },
    { _id: "pro4", nome: "Tratamento de canal", duracaoMin: 90, valor: 850 },
    { _id: "pro5", nome: "Clareamento", duracaoMin: 60, valor: 650 },
    { _id: "pro6", nome: "Extração simples", duracaoMin: 45, valor: 320 },
  ];

  const pacientes = [
    { _id: "pac1", nome: "Ana Beatriz Lopes", cpf: "000.000.001-91", telefone: "(11) 90000-0001", email: "ana.lopes@exemplo.com", dataNascimento: "1988-04-12", observacoes: "Alergia a dipirona." },
    { _id: "pac2", nome: "Bruno Carvalho", cpf: "000.000.002-72", telefone: "(11) 90000-0002", email: "bruno.c@exemplo.com", dataNascimento: "1975-11-30", observacoes: "" },
    { _id: "pac3", nome: "Carla Mendes", cpf: "000.000.003-53", telefone: "(11) 90000-0003", email: "carla.m@exemplo.com", dataNascimento: "1992-07-08", observacoes: "" },
    { _id: "pac4", nome: "Diego Ferreira", cpf: "000.000.004-34", telefone: "(11) 90000-0004", email: "diego.f@exemplo.com", dataNascimento: "2001-01-25", observacoes: "Usa aparelho fixo." },
    { _id: "pac5", nome: "Eduarda Ramos", cpf: "000.000.005-15", telefone: "(11) 90000-0005", email: "eduarda.r@exemplo.com", dataNascimento: "1969-09-17", observacoes: "Hipertensa, em tratamento." },
    { _id: "pac6", nome: "Felipe Araújo", cpf: "000.000.006-04", telefone: "(11) 90000-0006", email: "felipe.a@exemplo.com", dataNascimento: "1996-03-03", observacoes: "" },
    { _id: "pac7", nome: "Gabriela Pinto", cpf: "000.000.007-87", telefone: "(11) 90000-0007", email: "gabriela.p@exemplo.com", dataNascimento: "1984-12-21", observacoes: "" },
    { _id: "pac8", nome: "Henrique Souza", cpf: "000.000.008-68", telefone: "(11) 90000-0008", email: "henrique.s@exemplo.com", dataNascimento: "2010-06-14", observacoes: "Menor de idade, vem com responsável." },
  ];

  // [dias a partir de hoje, hora, minuto, paciente, dentista, procedimento, status]
  const grade = [
    [-1, 9, 0, "pac3", "den1", "pro1", "concluido"],
    [-1, 10, 30, "pac6", "den2", "pro3", "concluido"],
    [-1, 14, 0, "pac7", "den3", "pro2", "concluido"],
    [0, 8, 30, "pac1", "den1", "pro1", "concluido"],
    [0, 9, 30, "pac2", "den1", "pro3", "confirmado"],
    [0, 11, 0, "pac4", "den1", "pro2", "agendado"],
    [0, 14, 0, "pac5", "den1", "pro4", "confirmado"],
    [0, 9, 0, "pac6", "den2", "pro2", "confirmado"],
    [0, 10, 0, "pac7", "den2", "pro5", "agendado"],
    [0, 15, 0, "pac3", "den2", "pro6", "agendado"],
    [0, 8, 0, "pac8", "den3", "pro4", "confirmado"],
    [0, 13, 30, "pac2", "den3", "pro1", "cancelado"],
    [0, 16, 0, "pac1", "den3", "pro3", "agendado"],
    [1, 9, 0, "pac5", "den1", "pro1", "agendado"],
    [1, 11, 0, "pac8", "den2", "pro3", "confirmado"],
    [1, 15, 30, "pac4", "den3", "pro2", "agendado"],
    [2, 10, 0, "pac2", "den2", "pro4", "agendado"],
    [2, 14, 30, "pac6", "den1", "pro5", "agendado"],
  ];

  const agendamentos = grade.map(([dias, hora, minuto, pacienteId, dentistaId, procedimentoId, status], i) => {
    const inicio = new Date();
    inicio.setDate(inicio.getDate() + dias);
    inicio.setHours(hora, minuto, 0, 0);
    const { duracaoMin } = procedimentos.find((p) => p._id === procedimentoId);
    const fim = new Date(inicio.getTime() + duracaoMin * 60000);
    return {
      _id: `age${i + 1}`,
      pacienteId,
      dentistaId,
      procedimentoId,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      status,
      observacoes: "",
    };
  });

  return { dentistas, procedimentos, pacientes, agendamentos };
};
