const { db } = require('../config/firebase');

const COLLECTION = 'clientes';

async function listarTodos() {
  const snapshot = await db.collection(COLLECTION).where('ativo', '!=', false).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}

async function buscarPorId(id) {
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data()
  };
}

async function criar(dados) {
  const ref = await db.collection(COLLECTION).add(dados);
  return ref.id;
}

async function atualizar(id, dados) {
  await db.collection(COLLECTION).doc(id).set(dados, { merge: true });
}

module.exports = {
  listarTodos,
  buscarPorId,
  criar,
  atualizar
};
