// Usuários iniciais do modo demonstração. Este repositório é público: aqui ficam
// apenas hashes PBKDF2 de senhas temporárias aleatórias, nunca as senhas.
// Com o back-end real estes dados deixam de ser usados (ver docs/API.md).
window.criarUsuariosMock = function () {
  return [
    { _id: "usu1", nome: "Heloisa Arfelli Donato", login: "heloisa", nivel: "master", trocarSenha: true, senha: "pbkdf2$600000$ZCnSyQfN0K9Ckz5Y99j4VQ==$/RmjvGUNrLCJIyzu7gHDf4RqYkqdAWHc6JWegHrge3Q=" },
    { _id: "usu2", nome: "Sabrina Arfelli", login: "sabrina", nivel: "admin", trocarSenha: true, senha: "pbkdf2$600000$esBK8jahvqXLHkxHgcnBDQ==$12Id3rzspdiP6kKtIQNH+vlOPlurRtHKN9BgIp/jtSY=" },
    { _id: "usu3", nome: "Gabriel", login: "gabriel", nivel: "admin", trocarSenha: true, senha: "pbkdf2$600000$s9QrK8dSHgfZh3i0fT+Pig==$pvVxjSaEcbrKbGhI+O7lgfE2KLdus88SwPgVPeqymkA=" },
    { _id: "usu4", nome: "Thiago", login: "thiago", nivel: "admin", trocarSenha: true, senha: "pbkdf2$600000$nlffDPB9dQzYP3ahZD3/7w==$ZIs33sKL2CCt0sCsgOIyvt9SYyKpLhtAy0P8j5iJCnY=" },
    { _id: "usu5", nome: "Guilherme", login: "guilherme", nivel: "admin", trocarSenha: true, senha: "pbkdf2$600000$aPhpM0ljXH6kJTcyEMRhwg==$pzRFd8r+uU3i56dQiaVuUelpmidRUIQ+uGTeyaXhibU=" },
    { _id: "usu6", nome: "Isabela", login: "isabela", nivel: "admin", trocarSenha: true, senha: "pbkdf2$600000$01D/YMgmFvhUxiDp8aoW1A==$7IE9JGwkVT3fRRbwu73YDFYv19Jgpj9r7LXa8zMyFCc=" },
  ];
};
