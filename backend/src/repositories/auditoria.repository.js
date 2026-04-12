const { db } = require('../config/firebase');

async function registrar(log) {
  await db.collection('auditoria').add({
    ...log,
    criadoEm: new Date().toISOString()
  });
}

async function listarPorEntidade(entidade, entidadeId, limite = 60) {
  const snapshot = await db
    .collection('auditoria')
    .where('entidade', '==', entidade)
    .where('entidadeId', '==', entidadeId)
    .get();

  return snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data()
    }))
    .sort((primeiro, segundo) =>
      String(segundo.criadoEm || '').localeCompare(String(primeiro.criadoEm || ''))
    )
    .slice(0, limite);
}

module.exports = {
  registrar,
  listarPorEntidade
};
