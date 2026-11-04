import "dotenv/config";
import { criarApp } from "./app.js";
import { conectar } from "./banco.js";

const { MONGODB_URI, MONGODB_BANCO = "clinica", JWT_SECRET, ORIGENS_PERMITIDAS = "", PORT = 3000 } = process.env;

if (!MONGODB_URI) throw new Error("Defina MONGODB_URI (veja server/.env.example).");
if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error("Defina JWT_SECRET com 32 caracteres ou mais.");

const { cliente, banco } = await conectar(MONGODB_URI, MONGODB_BANCO);
const origens = ORIGENS_PERMITIDAS.split(",").map((origem) => origem.trim()).filter(Boolean);

criarApp({ cliente, banco, jwtSegredo: JWT_SECRET, origens }).listen(PORT, () => {
  console.log(`API da clínica na porta ${PORT}`);
});
