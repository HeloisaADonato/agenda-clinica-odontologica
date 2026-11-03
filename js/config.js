// Configuração do front-end. Para ligar o back-end real:
// 1. Troque USE_MOCK para false.
// 2. Aponte API_BASE_URL para o servidor (contrato em docs/API.md).
window.APP_CONFIG = {
  USE_MOCK: true,
  API_BASE_URL: "http://localhost:3000/api",

  // Horário de funcionamento da clínica, usado na grade da agenda.
  HORA_ABERTURA: 8,
  HORA_FECHAMENTO: 19,
  INTERVALO_MIN: 30,
};
