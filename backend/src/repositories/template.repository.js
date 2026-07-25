const { db } = require('../config/firebase');

const COLLECTION = 'templates';

async function criar(dados) {
  const ref = await db.collection(COLLECTION).add(dados);
  return ref.id;
}

async function buscarPorId(id) {
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function atualizar(id, dados) {
  await db.collection(COLLECTION).doc(id).update(dados);
}

async function listarAtivos() {
  const snapshot = await db.collection(COLLECTION).where('ativo', '!=', false).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function adicionarVersao(id, versao) {
  const ref = await db.collection(COLLECTION).doc(id).collection('versoes').add(versao);
  return ref.id;
}

async function listarVersoes(id) {
  const snapshot = await db.collection(COLLECTION).doc(id).collection('versoes').get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.numero || 0) - (a.numero || 0));
}

module.exports = {
  criar,
  buscarPorId,
  atualizar,
  listarAtivos,
  adicionarVersao,
  listarVersoes
};
