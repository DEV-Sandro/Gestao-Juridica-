const { db } = require('../config/firebase');

const COLLECTION = 'convitesEquipe';

async function buscarPorTokenHash(tokenHash) {
  const doc = await db.collection(COLLECTION).doc(tokenHash).get();
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data()
  };
}

async function criar(tokenHash, dados) {
  await db.collection(COLLECTION).doc(tokenHash).set(dados);
}

async function atualizar(tokenHash, dados) {
  await db.collection(COLLECTION).doc(tokenHash).set(dados, { merge: true });
}

async function listarPorEmail(email) {
  const snapshot = await db.collection(COLLECTION).where('email', '==', email).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}

module.exports = {
  buscarPorTokenHash,
  criar,
  atualizar,
  listarPorEmail
};
