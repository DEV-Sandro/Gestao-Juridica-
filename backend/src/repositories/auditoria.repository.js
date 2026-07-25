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

// Consulta administrativa global. Quando entidade/usuarioId sao informados, o
// filtro de igualdade e resolvido no Firestore (nao precisa de indice composto,
// pois nao ha orderBy combinado — mesmo padrao de listarPorEntidade). Sem
// filtro, usa orderBy+limit puro (tambem sem indice composto). A ordenacao final
// e sempre feita em memoria para cobrir os dois casos de forma consistente.
async function listarRecentes({ entidade, usuarioId } = {}) {
  let query = db.collection('auditoria');

  if (entidade) query = query.where('entidade', '==', entidade);
  if (usuarioId) query = query.where('usuarioId', '==', usuarioId);

  const snapshot =
    entidade || usuarioId ? await query.get() : await query.orderBy('criadoEm', 'desc').limit(500).get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((primeiro, segundo) =>
      String(segundo.criadoEm || '').localeCompare(String(primeiro.criadoEm || ''))
    );
}

module.exports = {
  registrar,
  listarPorEntidade,
  listarRecentes
};
