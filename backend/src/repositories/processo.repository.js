const { db } = require('../config/firebase');

async function buscarTodos() {
  const snapshot = await db.collection('processos').get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

async function buscarPorId(id) {
  const doc = await db.collection('processos').doc(id).get();

  if (!doc.exists) return null;

  return {
    id: doc.id,
    ...doc.data()
  };
}

async function criar(dados) {
  const ref = await db.collection('processos').add(dados);
  return ref.id;
}

async function atualizar(id, dados) {
  await db.collection('processos').doc(id).update(dados);
}

async function deletarSoft(id, dados = {}) {
  await db.collection('processos').doc(id).update({
    deletado: true,
    deletadoEm: new Date().toISOString(),
    ...dados
  });
}

module.exports = {
  buscarTodos,
  buscarPorId,
  criar,
  atualizar,
  deletarSoft
};