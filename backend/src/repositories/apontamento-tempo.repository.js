const { db } = require('../config/firebase');

const COLLECTION = 'apontamentosTempo';

async function criar(dados) {
  const ref = await db.collection(COLLECTION).add(dados);
  return ref.id;
}

async function buscarPorId(id) {
  const doc = await db.collection(COLLECTION).doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// O filtro de processo e aplicado no servico. Evita depender de indices e
// permite que um mesmo calculo agregue todos os processos visiveis ao usuario.
async function listarTodos() {
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// A projeção de rentabilidade mantém os totais no processo. Esta consulta
// limitada existe apenas para o histórico visual de ajustes recentes.
async function listarRecentesDoTenant(tenantId, limite = 20) {
  const snapshot = await db
    .collection(COLLECTION)
    .where('tenantId', '==', tenantId)
    .orderBy('criadoEm', 'desc')
    .limit(limite)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function deletar(id) {
  await db.collection(COLLECTION).doc(id).delete();
}

module.exports = {
  criar,
  buscarPorId,
  listarTodos,
  listarRecentesDoTenant,
  deletar
};
