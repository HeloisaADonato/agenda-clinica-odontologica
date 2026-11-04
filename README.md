# Agenda da Clínica Odontológica

Protótipo do front-end para gerenciar agendamentos de procedimentos de uma clínica odontológica. Feito em HTML, CSS e JavaScript puros, sem etapa de build.

**Site no ar:** https://heloisaadonato.github.io/agenda-clinica-odontologica/

## O que já funciona

- Agenda do dia com uma coluna por dentista, que vira lista no celular
- Criação, edição, cancelamento e exclusão de agendamentos
- Bloqueio de dois agendamentos no mesmo horário para o mesmo dentista
- Filtros por data, dentista e status
- Cadastros de pacientes, procedimentos e dentistas, com busca
- Login com senha, troca obrigatória da senha temporária e dois níveis de acesso

## Níveis de acesso

| | Admin master | Admin tradicional |
| --- | --- | --- |
| Ver, criar e editar agenda e cadastros | sim | sim |
| Cancelar agendamentos | sim | sim |
| Excluir agendamentos e cadastros | sim | não |
| Gerenciar usuários e senhas | sim | não |
| Restaurar os dados de demonstração | sim | não |

## Como rodar

Abra o `index.html` no navegador. Por padrão o site usa o **modo demonstração**: os dados são fictícios e ficam salvos apenas no navegador de quem está testando, inclusive as senhas alteradas.

Neste modo o login roda no navegador e não protege dados de verdade. A proteção real vem da API.

No VS Code, a extensão Live Server recarrega a página a cada alteração.

## Back-end

A API fica em [server/](server/), feita com Node.js, Express e MongoDB, seguindo o contrato de [docs/API.md](docs/API.md). Para publicar o banco e a API, siga [docs/PUBLICAR.md](docs/PUBLICAR.md).

Comandos, dentro da pasta `server`:

```
npm install
npm test           Roda os testes com um MongoDB temporário
npm run seed       Cria índices e usuários iniciais no banco do .env
npm run seed:demo  Faz o mesmo e adiciona dados fictícios
npm start          Sobe a API
```

Toda a comunicação do site com o servidor fica em [js/api.js](js/api.js), e a escolha entre modo demonstração e API real fica em [js/config.js](js/config.js).

## Estrutura

```
index.html        Estrutura da página
css/styles.css    Estilos e regras responsivas
js/config.js      Configuração (modo demonstração, URL da API, horário da clínica)
js/api.js         Comunicação com o back-end e modo demonstração
js/mock-data.js   Dados fictícios
js/usuarios-demo.js  Usuários do modo demonstração (somente hashes)
js/app.js         Telas e interações
docs/API.md       Contrato da API
docs/PUBLICAR.md  Como publicar o banco e a API
server/           API em Node.js com MongoDB
render.yaml       Configuração de publicação no Render
```

## Cuidados

Não coloque dados reais de pacientes neste repositório, nem senhas ou a string de conexão do MongoDB. Essas informações ficam em um arquivo `.env` no back-end, que o `.gitignore` já exclui.
