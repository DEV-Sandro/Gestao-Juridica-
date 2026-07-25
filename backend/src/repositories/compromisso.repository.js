const { db } = require('../config/firebase');

async function criar(dados) {
  const ref = await db.collection('compromissos').add(dados);
  return ref.id;
}

async function buscarPorId(id) {
  const doc = await db.collection('compromissos').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function atualizar(id, dados) {
  await db.collection('compromissos').doc(id).update(dados);
}

async function deletarSoft(id, dados = {}) {
  await db.collection('compromissos').doc(id).update({
    deletado: true,
    deletadoEm: new Date().toISOString(),
    ...dados
  });
}

async function buscarTodos() {
  const snapshot = await db.collection('compromissos').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Busca por advogado(s) — igualdade/`in` simples, seguro no Firestore sem
// indice composto (testado em produção). O recorte por intervalo de datas e a
// deteccao de conflito de horario acontecem em memoria no service, pelo mesmo
// motivo documentado em processo.repository.js#buscarPorEscopo: combinar um
// filtro de igualdade/`in` com um range (>=/<=) numa data exigiria um indice
// composto que ainda nao existe no projeto.
async function buscarPorAdvogados(advogadoIds) {
  if (!Array.isArray(advogadoIds) || advogadoIds.length === 0) {
    return [];
  }

  const snapshot = await db
    .collection('compromissos')
    .where('advogadoId', 'in', advogadoIds.slice(0, 10))
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

module.exports = {
  criar,
  buscarPorId,
  atualizar,
  deletarSoft,
  buscarTodos,
  buscarPorAdvogados
};
