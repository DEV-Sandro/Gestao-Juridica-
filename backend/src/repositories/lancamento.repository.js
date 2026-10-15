const { db } = require('../config/firebase');

const COLLECTION = 'lancamentos';

async function criar(dados) {
  const ref = await db.collection(COLLECTION).add(dados);
  return ref.id;
}

async function criarEmLote(listaDados) {
  const batch = db.batch();
  const ids = [];

  for (const dados of listaDados) {
    const ref = db.collection(COLLECTION).doc();
    batch.set(ref, dados);
    ids.push(ref.id);
  }

  await batch.commit();
  return ids;
}

async function buscarPorId(id) {
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function atualizar(id, dados) {
  await db.collection(COLLECTION).doc(id).update(dados);
}

async function deletarSoft(id, dados = {}) {
  await db.collection(COLLECTION).doc(id).update({
    deletado: true,
    deletadoEm: new Date().toISOString(),
    ...dados
  });
}

// Filtros de igualdade sao empurrados para o Firestore; o recorte por periodo
// (vencimento) fica em memoria no service, seguindo o mesmo padrao ja adotado em
// processo/compromisso — evita depender de indice composto (igualdade + range).
async function buscar({ processoId, clienteId, advogadoId, status } = {}) {
  let query = db.collection(COLLECTION);

  if (processoId) query = query.where('processoId', '==', processoId);
  if (clienteId) query = query.where('clienteId', '==', clienteId);
  if (advogadoId) query = query.where('advogadoId', '==', advogadoId);
  if (status) query = query.where('status', '==', status);

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

module.exports = {
  criar,
  criarEmLote,
  buscarPorId,
  atualizar,
  deletarSoft,
  buscar
};
