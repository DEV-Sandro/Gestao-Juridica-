const { admin, db } = require('../config/firebase');

const STATUS_ABERTOS = new Set(['PENDING', 'ACKNOWLEDGED', 'PENDENTE', 'RECONHECIDO']);

function paraData(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === 'function') return valor.toDate();

  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function calcularNivelRisco(dueAt, status, agora = new Date()) {
  if (!STATUS_ABERTOS.has(String(status || '').trim().toUpperCase())) {
    return 'normal';
  }

  const prazo = paraData(dueAt);
  if (!prazo) return 'normal';

  const horasRestantes = (prazo.getTime() - agora.getTime()) / (60 * 60 * 1000);
  if (horasRestantes <= 24) return 'critical';
  if (horasRestantes <= 72) return 'warning';
  return 'normal';
}

// Esta funcao e segura para execucao horaria por Cloud Scheduler/Cloud Run:
// ela so atualiza documentos cujo nivel calculado mudou.
async function atualizarNiveisRisco({ dryRun = false, agora = new Date() } = {}) {
  const snapshot = await db.collectionGroup('deadlines').get();
  let avaliados = 0;
  let atualizados = 0;
  let batch = db.batch();
  let pendentesNoLote = 0;
  let commits = 0;

  for (const doc of snapshot.docs) {
    const dados = doc.data();
    const riskLevel = calcularNivelRisco(dados.dueAt, dados.status, agora);
    avaliados += 1;

    if (dados.riskLevel === riskLevel) continue;
    atualizados += 1;
    if (dryRun) continue;

    batch.update(doc.ref, {
      riskLevel,
      riskUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    pendentesNoLote += 1;

    if (pendentesNoLote >= 400) {
      await batch.commit();
      commits += 1;
      batch = db.batch();
      pendentesNoLote = 0;
    }
  }

  if (!dryRun && pendentesNoLote > 0) {
    await batch.commit();
    commits += 1;
  }

  return { avaliados, atualizados, commits, dryRun };
}

module.exports = { calcularNivelRisco, atualizarNiveisRisco };
