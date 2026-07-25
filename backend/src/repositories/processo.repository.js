const { db } = require('../config/firebase');

async function buscarTodos() {
  const snapshot = await db.collection('processos').get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

// Busca já filtrada no Firestore por escopo (clienteId) e, opcionalmente,
// categoria/tipoCausa/situacao/tags — evita puxar a coleção inteira a cada
// listagem para os casos em que o filtro é seguro. Testado em produção: Firestore
// resolve automaticamente essa combinação (varias igualdades + array-contains-any)
// sem exigir índice composto manual.
//
// IMPORTANTE: advogadoId propositalmente NÃO é filtrado aqui. Existem processos
// legados sem advogadoId definido (verificado em produção) que o serviço trata
// como visíveis a todos os advogados até serem triados manualmente — filtrar por
// igualdade no Firestore excluiria esses documentos por completo (campo ausente
// nunca casa com `==`), o que seria uma regressão silenciosa. O escopo por
// advogado continua sendo aplicado em memória em processo.service.js.
async function buscarPorEscopo({ clienteId, categoria, tipoCausa, situacao, tags } = {}) {
  let query = db.collection('processos');

  if (clienteId) {
    query = query.where('clienteId', '==', clienteId);
  }

  if (categoria) {
    query = query.where('categoria', '==', categoria);
  }

  if (tipoCausa) {
    query = query.where('tipoCausa', '==', tipoCausa);
  }

  if (situacao) {
    query = query.where('situacao', '==', situacao);
  }

  if (Array.isArray(tags) && tags.length > 0) {
    // Firestore permite ate 10 valores por array-contains-any.
    query = query.where('tags', 'array-contains-any', tags.slice(0, 10));
  }

  const snapshot = await query.get();

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
  buscarPorEscopo,
  buscarPorId,
  criar,
  atualizar,
  deletarSoft
};