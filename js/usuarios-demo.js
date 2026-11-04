// Usuários iniciais do modo demonstração. Este repositório é público: aqui ficam
// apenas hashes PBKDF2 de senhas temporárias aleatórias, nunca as senhas.
// Com o back-end real estes dados deixam de ser usados (ver docs/API.md).
window.criarUsuariosMock = function () {
  return [
    { _id: "usu1", nome: "Heloisa Arfelli Donato", login: "heloisa", nivel: "master", trocarSenha: true, senha: "pbkdf2$600000$xukIVNVtmHl141rf6UT14w==$SttOOqPU+9p7LkT9IiatwL8TshtwEx6e8T11tzxQlD8=" },
    { _id: "usu2", nome: "Sabrina Arfelli", login: "sabrina", nivel: "admin", trocarSenha: true, senha: "pbkdf2$600000$wYt/B4gxOaI6Qd2c4nDTig==$/2+DJIWGGxKYQqKfMbczAzkozPKIKYR+310c+Sr+2lg=" },
    { _id: "usu3", nome: "Gabriel", login: "gabriel", nivel: "admin", trocarSenha: true, senha: "pbkdf2$600000$nw6hBzWDjDTD+oz69PLF3A==$BJujeDa5nLr4NWn4nF1mkbgpCyOHOXBU24gU3+HfhQo=" },
    { _id: "usu4", nome: "Thiago", login: "thiago", nivel: "admin", trocarSenha: true, senha: "pbkdf2$600000$1I5FZNnOhPfAlikeDP3qeA==$YCB1SXVZvXoim52rJtm2ej8e1OjmpASUaVjIio1EDJc=" },
    { _id: "usu5", nome: "Guilherme", login: "guilherme", nivel: "admin", trocarSenha: true, senha: "pbkdf2$600000$r46b0vQEqrGXQN9nfyss3Q==$zOJs99stKVcTZS0q75pBS7elioR5Lg7JWX5PcaRlPrI=" },
    { _id: "usu6", nome: "Isabela", login: "isabela", nivel: "admin", trocarSenha: true, senha: "pbkdf2$600000$Jj6MZkcpQ9z2+HMXHozFyw==$jVBABSPDiN5/qXAjchrzwjEcikuTHWd5zzmwo82f044=" },
  ];
};
