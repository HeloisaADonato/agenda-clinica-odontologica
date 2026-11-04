# Contrato da API

Este documento descreve o contrato entre o front-end e o back-end, que está implementado em [server/](../server/). Se algum endpoint precisar mudar, a única parte do front que precisa de ajuste é [js/api.js](../js/api.js). O passo a passo de publicação está em [PUBLICAR.md](PUBLICAR.md).

## Como ligar o front ao back-end

Em [js/config.js](../js/config.js):

```js
USE_MOCK: false,
API_BASE_URL: "http://localhost:3000/api",
```

## Regras gerais

- Corpo das requisições e respostas em JSON.
- O identificador de cada documento é o `_id` do MongoDB, enviado como string.
- Datas de agendamento (`inicio`, `fim`) são strings ISO 8601 em UTC, por exemplo `2026-11-03T12:30:00.000Z`. O front converte para o fuso local.
- Em caso de erro, responda com o status HTTP adequado e este corpo. O texto de `mensagem` é exibido diretamente ao usuário:

```json
{ "mensagem": "Este dentista já tem um agendamento nesse horário." }
```

- O servidor precisa liberar CORS para a origem do front (a URL do GitHub Pages e `http://localhost` durante o desenvolvimento).
- Se o front estiver no GitHub Pages (HTTPS), a API também precisa estar em HTTPS, ou o navegador bloqueia as chamadas.

## Endpoints

Os cinco recursos (`pacientes`, `dentistas`, `procedimentos`, `agendamentos`, `usuarios`) usam o mesmo formato:

| Método | Rota | Corpo | Sucesso |
| --- | --- | --- | --- |
| GET | `/{recurso}` | | `200` com array de documentos |
| POST | `/{recurso}` | documento sem `_id` | `201` com o documento criado |
| PUT | `/{recurso}/:id` | documento completo sem `_id` | `200` com o documento atualizado |
| DELETE | `/{recurso}/:id` | | `204` sem corpo |

`GET /agendamentos` recebe dois filtros de consulta, e o front sempre envia os dois:

| Parâmetro | Significado |
| --- | --- |
| `de` | ISO 8601. Retorna agendamentos com `inicio >= de` |
| `ate` | ISO 8601. Retorna agendamentos com `inicio < ate` |

## Autenticação

Todas as rotas exigem login, menos `POST /auth/login`. O front envia o token em todas as chamadas:

```
Authorization: Bearer <token>
```

| Método | Rota | Corpo | Sucesso |
| --- | --- | --- | --- |
| POST | `/auth/login` | `{ "login", "senha" }` | `200` com `{ "token", "usuario" }` |
| GET | `/auth/eu` | | `200` com o usuário logado |
| PUT | `/auth/senha` | `{ "senhaAtual", "novaSenha" }` | `200` com `{ "token", "usuario" }` |

O objeto `usuario` traz `_id`, `nome`, `login`, `nivel` e `trocarSenha`, nunca a senha nem o hash.

Trocar ou redefinir a senha invalida os tokens anteriores do usuário. Por isso `PUT /auth/senha` devolve um token novo.

Um `401` com token enviado faz o front encerrar a sessão e voltar ao login. Por isso, senha atual incorreta em `PUT /auth/senha` responde `400`, não `401`.

## Níveis de acesso

| Ação | `master` | `admin` |
| --- | --- | --- |
| Ver agenda e cadastros | sim | sim |
| Criar e editar agendamentos, inclusive cancelar | sim | sim |
| Criar e editar pacientes, procedimentos e dentistas | sim | sim |
| Alterar a própria senha | sim | sim |
| Excluir agendamentos e cadastros (`DELETE`) | sim | não, `403` |
| Qualquer rota de `/usuarios` | sim | não, `403` |

Esconder um botão no front não protege nada. Cada rota precisa conferir o nível no servidor, usando o usuário do token, nunca um nível enviado pelo navegador.

## Coleções

### pacientes

| Campo | Tipo | Obrigatório | Observação |
| --- | --- | --- | --- |
| `nome` | string | sim | |
| `cpf` | string | sim | deve ser único |
| `telefone` | string | sim | |
| `email` | string | não | |
| `dataNascimento` | string | não | formato `AAAA-MM-DD` |
| `observacoes` | string | não | dado de saúde, ver seção de segurança |

### dentistas

| Campo | Tipo | Obrigatório |
| --- | --- | --- |
| `nome` | string | sim |
| `cro` | string | sim |
| `especialidade` | string | sim |

### procedimentos

| Campo | Tipo | Obrigatório | Observação |
| --- | --- | --- | --- |
| `nome` | string | sim | |
| `duracaoMin` | number | sim | mínimo 15 |
| `valor` | number | sim | em reais |

### agendamentos

| Campo | Tipo | Obrigatório | Observação |
| --- | --- | --- | --- |
| `pacienteId` | string | sim | `_id` de um paciente |
| `dentistaId` | string | sim | `_id` de um dentista |
| `procedimentoId` | string | sim | `_id` de um procedimento |
| `inicio` | string | sim | ISO 8601 |
| `fim` | string | sim | calculado pelo front a partir de `duracaoMin` |
| `status` | string | sim | `agendado`, `confirmado`, `concluido` ou `cancelado` |
| `observacoes` | string | não | |

Os IDs voltam como strings simples, sem `populate`. O front cruza os dados com as listas de pacientes, dentistas e procedimentos.

### usuarios

| Campo | Tipo | Obrigatório | Observação |
| --- | --- | --- | --- |
| `nome` | string | sim | |
| `login` | string | sim | único, minúsculo |
| `nivel` | string | sim | `master` ou `admin` |
| `senha` | string | ao criar | só na entrada: salve apenas o hash e nunca devolva este campo. No `PUT`, ausente mantém a senha atual |
| `trocarSenha` | boolean | | definido pelo servidor: `true` ao criar ou redefinir a senha, `false` depois de `PUT /auth/senha` |

Usuários iniciais, criados por `npm run seed` com uma senha temporária aleatória para cada um:

| `nome` | `login` | `nivel` |
| --- | --- | --- |
| Heloisa Arfelli Donato | `heloisa` | `master` |
| Sabrina Arfelli | `sabrina` | `admin` |
| Gabriel | `gabriel` | `admin` |
| Thiago | `thiago` | `admin` |
| Guilherme | `guilherme` | `admin` |
| Isabela | `isabela` | `admin` |

## Regras de negócio garantidas pelo back-end

O front valida o básico, mas estas regras valem no servidor. O modo demonstração se comporta do mesmo jeito.

| Situação | Resposta |
| --- | --- |
| Agendamento sobrepõe outro do mesmo dentista (ignorando os `cancelado`) | `409` |
| Excluir paciente, dentista ou procedimento com agendamento não cancelado | `409` |
| Registro inexistente | `404` |
| Campo obrigatório ausente ou inválido | `400` |
| Sem token, token inválido ou expirado, login ou senha incorretos | `401` |
| Nível sem permissão para a ação | `403` |
| Usuário com `trocarSenha: true` em qualquer rota além de `/auth/eu` e `/auth/senha` | `403` |
| `login` repetido | `409` |
| Excluir o próprio usuário ou rebaixar o último `master` | `409` |

Dois agendamentos se sobrepõem quando `a.inicio < b.fim` e `a.fim > b.inicio`. Um agendamento que termina às 10:00 não conflita com outro que começa às 10:00.

A conferência de horário roda em uma transação do MongoDB, que precisa de um replica set. O Atlas já funciona assim, mas um `mongod` simples instalado na máquina não aceita transações.

## Segurança

O login do modo demonstração roda no navegador e serve para testar as telas: quem abre as ferramentas do navegador consegue contorná-lo. A proteção real vem do back-end, que já faz o seguinte:

- Salva senhas com bcrypt.
- Emite tokens assinados que valem 8 horas, com a chave em `JWT_SECRET`.
- Limita a 10 as tentativas de login erradas a cada 15 minutos por IP.
- Confere o nível em cada rota, lendo o usuário do banco a cada chamada.
- Aceita chamadas de navegador só das origens em `ORIGENS_PERMITIDAS`.

A API em produção precisa estar em HTTPS, o que o Render já oferece. Como o sistema guarda dados pessoais e de saúde, protegidos pela LGPD, avaliem os requisitos da lei antes de cadastrar pacientes reais.

Os hashes de [js/usuarios-demo.js](../js/usuarios-demo.js) são só da demonstração e não valem no banco real.
