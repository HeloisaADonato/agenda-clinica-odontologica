// Usuários iniciais do modo demonstração. Neste modo não há senha: cada pessoa
// escolhe o próprio nome para entrar. Com o back-end real o login exige senha
// e estes dados deixam de ser usados (ver docs/API.md).
window.criarUsuariosMock = function () {
  return [
    { _id: "usu1", nome: "Heloisa Arfelli Donato", login: "heloisa", nivel: "master", trocarSenha: false },
    { _id: "usu2", nome: "Sabrina Arfelli", login: "sabrina", nivel: "admin", trocarSenha: false },
    { _id: "usu3", nome: "Gabriel", login: "gabriel", nivel: "admin", trocarSenha: false },
    { _id: "usu4", nome: "Thiago", login: "thiago", nivel: "admin", trocarSenha: false },
    { _id: "usu5", nome: "Guilherme", login: "guilherme", nivel: "admin", trocarSenha: false },
    { _id: "usu6", nome: "Isabela", login: "isabela", nivel: "admin", trocarSenha: false },
  ];
};
