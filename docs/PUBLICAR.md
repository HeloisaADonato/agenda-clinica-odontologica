# Como colocar o banco e a API no ar

São três etapas: criar o banco no MongoDB Atlas, preparar os dados e publicar a API no Render. Os dois serviços têm plano gratuito. Os nomes dos botões podem mudar um pouco com o tempo.

Nunca coloque a string de conexão no chat, em grupos ou no GitHub. Ela dá acesso a todos os dados.

## 1. Criar o banco no MongoDB Atlas

1. Crie uma conta em https://www.mongodb.com/cloud/atlas/register.
2. Crie um cluster do tipo **Free**.
3. Em **Database Access**, crie um usuário do banco. Use a senha gerada automaticamente e guarde-a em um lugar seguro.
4. Em **Network Access**, adicione o endereço `0.0.0.0/0`. Isso é necessário porque o Render gratuito não tem IP fixo. A proteção passa a depender da senha do passo anterior, então não use uma senha fraca.
5. Clique em **Connect**, depois em **Drivers**, e copie a string de conexão. Troque `<db_password>` pela senha do usuário.

## 2. Preparar os dados

No VS Code, copie `server/.env.example` para `server/.env` e preencha `MONGODB_URI` com a string de conexão. Depois, no terminal:

```
cd server
npm install
npm run seed:demo
```

Isso cria os seis usuários e dados fictícios de dentistas, procedimentos, pacientes e agenda. Para começar com o banco vazio, use `npm run seed`.

As senhas temporárias ficam em `server/senhas-iniciais.txt`, que não vai para o GitHub. Passe a cada pessoa só a senha dela. Elas são diferentes das senhas do modo demonstração.

## 3. Publicar a API no Render

1. Crie uma conta em https://render.com entrando com o GitHub.
2. Escolha **New**, depois **Blueprint**, e selecione o repositório `agenda-clinica-odontologica`. O Render lê o arquivo `render.yaml`.
3. Quando pedir `MONGODB_URI`, cole a mesma string de conexão.
4. Aguarde a publicação e copie o endereço do serviço, algo como `https://agenda-clinica-api.onrender.com`.
5. Abra esse endereço com `/api/saude` no final. A resposta esperada é `{"ok":true}`.

## 4. Ligar o site à API

Em [js/config.js](../js/config.js):

```js
USE_MOCK: false,
API_BASE_URL: "https://agenda-clinica-api.onrender.com/api",
```

Depois que a alteração subir para o GitHub, o site passa a salvar tudo no banco, para todas as pessoas.

## Limites do plano gratuito

- **Render:** o serviço adormece depois de 15 minutos sem uso, e a primeira resposta leva cerca de um minuto. O próprio Render não recomenda o plano gratuito para produção.
- **Atlas:** 0,5 GB de dados. O cluster é pausado depois de 30 dias sem conexões. O backup não vem ligado, então ative-o nas opções do cluster.

Este plano serve para o protótipo. Para dados reais de pacientes, avaliem antes os requisitos da LGPD e um plano pago com backup.
