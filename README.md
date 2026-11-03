# Agenda da Clínica Odontológica

Protótipo do front-end para gerenciar agendamentos de procedimentos de uma clínica odontológica. Feito em HTML, CSS e JavaScript puros, sem etapa de build.

**Site no ar:** https://heloisaadonato.github.io/agenda-clinica-odontologica/

## O que já funciona

- Agenda do dia com uma coluna por dentista, que vira lista no celular
- Criação, edição, cancelamento e exclusão de agendamentos
- Bloqueio de dois agendamentos no mesmo horário para o mesmo dentista
- Filtros por data, dentista e status
- Cadastros de pacientes, procedimentos e dentistas, com busca

## Como rodar

Abra o `index.html` no navegador. Por padrão o site usa o **modo demonstração**: os dados são fictícios e ficam salvos apenas no navegador de quem está testando.

No VS Code, a extensão Live Server recarrega a página a cada alteração.

## Para quem vai fazer o back-end

1. Implemente a API seguindo o contrato em [docs/API.md](docs/API.md).
2. Em [js/config.js](js/config.js), troque `USE_MOCK` para `false` e ajuste `API_BASE_URL`.

Toda a comunicação com o servidor fica em [js/api.js](js/api.js). As telas não precisam mudar.

## Estrutura

```
index.html        Estrutura da página
css/styles.css    Estilos e regras responsivas
js/config.js      Configuração (modo demonstração, URL da API, horário da clínica)
js/api.js         Comunicação com o back-end e modo demonstração
js/mock-data.js   Dados fictícios
js/app.js         Telas e interações
docs/API.md       Contrato da API para o back-end
```

## Cuidados

Não coloque dados reais de pacientes neste repositório, nem senhas ou a string de conexão do MongoDB. Essas informações ficam em um arquivo `.env` no back-end, que o `.gitignore` já exclui.
