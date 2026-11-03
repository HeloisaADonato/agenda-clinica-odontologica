# Contrato da API

Este documento descreve o que o front-end espera do back-end. Se algum endpoint precisar mudar, a única parte do front que precisa de ajuste é [js/api.js](../js/api.js).

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

Os quatro recursos (`pacientes`, `dentistas`, `procedimentos`, `agendamentos`) usam o mesmo formato:

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

## Regras de negócio que o back-end precisa garantir

O front valida o básico, mas estas regras precisam existir no servidor. O modo demonstração já se comporta assim, então dá para usá-lo como referência.

| Situação | Resposta |
| --- | --- |
| Agendamento sobrepõe outro do mesmo dentista (ignorando os `cancelado`) | `409` |
| Excluir paciente, dentista ou procedimento com agendamento não cancelado | `409` |
| Registro inexistente | `404` |
| Campo obrigatório ausente ou inválido | `400` |

Dois agendamentos se sobrepõem quando `a.inicio < b.fim` e `a.fim > b.inicio`. Um agendamento que termina às 10:00 não conflita com outro que começa às 10:00.

## Segurança

O protótipo ainda não tem login. Como o sistema guarda dados pessoais e de saúde, protegidos pela LGPD, a API não deve ir para um endereço público sem autenticação. Quando o login for definido, o cabeçalho de autenticação entra na função `requisitar` de [js/api.js](../js/api.js).
