// Conexão com o MongoDB e índices. Os índices únicos são a garantia final contra duplicidade.
import { MongoClient } from "mongodb";

export async function conectar(uri, nomeBanco) {
  const cliente = new MongoClient(uri);
  await cliente.connect();
  const banco = cliente.db(nomeBanco);
  await garantirIndices(banco);
  return { cliente, banco };
}

export async function garantirIndices(banco) {
  await Promise.all([
    banco.collection("usuarios").createIndex({ login: 1 }, { unique: true }),
    banco.collection("pacientes").createIndex({ cpf: 1 }, { unique: true }),
    banco.collection("agendamentos").createIndex({ dentistaId: 1, inicio: 1 }),
    banco.collection("agendamentos").createIndex({ inicio: 1 }),
    banco.collection("agendamentos").createIndex({ pacienteId: 1 }),
    banco.collection("agendamentos").createIndex({ procedimentoId: 1 }),
  ]);
}
