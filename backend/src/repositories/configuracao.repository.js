const { db, admin } = require('../config/firebase');

async function buscarPorId(id) {
  const doc = await db.collection('configuracoes').doc(id).get();
  return doc.exists ? doc.data() : null;
}

async function salvar(id, dados) {
  await db.collection('configuracoes').doc(id).set(dados, { merge: true });
}

async function listarTodas() {
  const snapshot = await db.collection('configuracoes').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Merge atomico de valores num array de uma configuracao (ex.: tags usadas nos
// processos) — usa arrayUnion para evitar corrida entre escritas concorrentes
// (nunca precisa ler antes de escrever, o proprio Firestore faz o merge).
async function adicionarValoresArray(id, campo, valores) {
  if (!Array.isArray(valores) || valores.length === 0) return;

  await db
    .collection('configuracoes')
    .doc(id)
    .set({ [campo]: admin.firestore.FieldValue.arrayUnion(...valores) }, { merge: true });
}

module.exports = {
  buscarPorId,
  salvar,
  listarTodas,
  adicionarValoresArray
};
