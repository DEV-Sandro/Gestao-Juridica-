const { db } = require('../config/firebase');

function collection(procId) {
  return db.collection('processos').doc(procId).collection('etapas');
}

async function listar(procId) {
  const snapshot = await collection(procId).orderBy('dataLimite', 'asc').get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}

async function criar(procId, dados) {
  const ref = await collection(procId).add(dados);
  return ref.id;
}

async function atualizar(procId, etapaId, dados) {
  await collection(procId).doc(etapaId).update(dados);
}

async function deletar(procId, etapaId) {
  await collection(procId).doc(etapaId).delete();
}

async function buscarPorId(procId, etapaId) {
  const doc = await collection(procId).doc(etapaId).get();
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data()
  };
}

module.exports = {
  buscarPorId,
  criar,
  deletar,
  listar,
  atualizar
};
