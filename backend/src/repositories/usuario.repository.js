const { db } = require('../config/firebase');

const COLLECTION = 'usuarios';

async function buscarPorId(uid) {
  const doc = await db.collection(COLLECTION).doc(uid).get();
  if (!doc.exists) return null;
  return { uid: doc.id, ...doc.data() };
}

async function criarOuAtualizar(uid, dados) {
  await db.collection(COLLECTION).doc(uid).set(dados, { merge: true });
}

async function atualizar(uid, dados) {
  await db.collection(COLLECTION).doc(uid).update(dados);
}

async function listarTodos() {
  const snapshot = await db
    .collection(COLLECTION)
    .where('ativo', '!=', false)
    .get();

  return snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
}

async function desativar(uid) {
  await db.collection(COLLECTION).doc(uid).update({
    ativo: false,
    desativadoEm: new Date().toISOString()
  });
}

module.exports = {
  buscarPorId,
  criarOuAtualizar,
  atualizar,
  listarTodos,
  desativar
};
