// Migra o modelo plano legado para o modelo hierarquico por tenant.
//
// O script e aditivo: copia para /tenants/{tenantId}/... usando os mesmos IDs,
// nao apaga nem altera as colecoes legadas. Isso permite validar as consultas
// novas antes de mudar os endpoints de producao.
//
// Uso:
//   node scripts/migrate-tenant-subcollections.js            (dry-run)
//   node scripts/migrate-tenant-subcollections.js --apply    (copia dados)

const { admin, db } = require('../src/config/firebase');
const { TENANT_PADRAO } = require('../src/config/tenant');
const { colecaoDoTenant, tenantRef } = require('../src/repositories/tenant-paths.repository');
const { calcularNivelRisco } = require('../src/jobs/deadline-risk.job');

const APLICAR = process.argv.includes('--apply');
const AGORA = new Date().toISOString();

function tenantDo(dados) {
  return dados?.tenantId || TENANT_PADRAO;
}

function timestampDo(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === 'function') return valor;

  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : admin.firestore.Timestamp.fromDate(data);
}

function statusPrazo(status) {
  const mapa = {
    PENDENTE: 'pending',
    CONCLUIDO: 'completed',
    CANCELADO: 'completed',
    PENDING: 'pending',
    ACKNOWLEDGED: 'acknowledged',
    COMPLETED: 'completed'
  };
  return mapa[String(status || 'PENDENTE').trim().toUpperCase()] || 'pending';
}

function papelMembro(role) {
  const mapa = { ADMIN: 'admin', ADVOGADO: 'lawyer', PARALEGAL: 'paralegal', CLIENT: 'client' };
  return mapa[String(role || 'CLIENT').trim().toUpperCase()] || 'client';
}

function mapearMembro(doc) {
  const dados = doc.data();
  return {
    userId: doc.id,
    role: papelMembro(dados.role),
    isActive: dados.ativo !== false,
    displayName: dados.displayName || null,
    email: dados.email || null,
    legacySource: 'usuarios',
    legacyId: doc.id,
    migratedAt: AGORA
  };
}

function mapearCliente(doc) {
  const dados = doc.data();
  return {
    ...dados,
    document: dados.cpf || dados.documentoSecundario || null,
    name: dados.nome || null,
    status: dados.ativo === false ? 'inactive' : 'active',
    legacySource: 'clientes',
    legacyId: doc.id,
    migratedAt: AGORA
  };
}

function mapearProcesso(doc) {
  const dados = doc.data();
  return {
    ...dados,
    clientId: dados.clienteId || null,
    cnj: dados.cnj || dados.numeroProcesso || null,
    profitabilityStatus: dados.rentabilidadeStatus || 'unknown',
    legacySource: 'processos',
    legacyId: doc.id,
    migratedAt: AGORA
  };
}

function mapearPrazo(doc) {
  const dados = doc.data();
  const dueAt = timestampDo(dados.dataFim || dados.dataInicio || dados.prazo);
  const status = statusPrazo(dados.status);

  return {
    ...dados,
    processId: dados.processoId || null,
    assigneeId: dados.advogadoId || null,
    dueAt,
    status,
    riskLevel: calcularNivelRisco(dueAt, status),
    legacySource: 'compromissos',
    legacyId: doc.id,
    migratedAt: AGORA
  };
}

function mapearApontamento(doc) {
  const dados = doc.data();
  const minutos = Number(dados.minutos);

  return {
    ...dados,
    processId: dados.processoId || null,
    userId: dados.criadoPor || dados.advogadoId || null,
    durationSeconds: Number.isFinite(minutos) ? Math.max(0, Math.round(minutos * 60)) : 0,
    costRateSnapshot: Number.isFinite(Number(dados.custoHora)) ? Number(dados.custoHora) : null,
    entryAt: timestampDo(dados.data || dados.criadoEm),
    legacySource: 'apontamentosTempo',
    legacyId: doc.id,
    migratedAt: AGORA
  };
}

const MIGRACOES = [
  { origem: 'usuarios', destino: 'members', mapear: mapearMembro },
  { origem: 'clientes', destino: 'clients', mapear: mapearCliente },
  { origem: 'processos', destino: 'processes', mapear: mapearProcesso },
  {
    origem: 'compromissos',
    destino: 'deadlines',
    incluir: (dados) => String(dados.tipo || '').toUpperCase() === 'PRAZO',
    mapear: mapearPrazo
  },
  { origem: 'apontamentosTempo', destino: 'timeEntries', mapear: mapearApontamento }
];

async function carregarOrigens() {
  const registros = [];
  for (const migracao of MIGRACOES) {
    const snapshot = await db.collection(migracao.origem).get();
    registros.push({ migracao, docs: snapshot.docs });
  }
  return registros;
}

async function garantirTenants(tenantIds) {
  if (!APLICAR) return;

  let batch = db.batch();
  let pendentes = 0;
  for (const tenantId of tenantIds) {
    batch.set(
      tenantRef(tenantId),
      {
        nome: tenantId === TENANT_PADRAO ? 'Escritorio principal' : tenantId,
        ativo: true,
        plano: tenantId === TENANT_PADRAO ? 'fundador' : 'migrado',
        schemaVersion: 2,
        atualizadoEm: AGORA
      },
      { merge: true }
    );
    pendentes += 1;

    if (pendentes >= 400) {
      await batch.commit();
      batch = db.batch();
      pendentes = 0;
    }
  }
  if (pendentes) await batch.commit();
}

async function copiarRegistros(registros) {
  let total = 0;

  for (const { migracao, docs } of registros) {
    let elegiveis = 0;
    let batch = db.batch();
    let pendentes = 0;
    let commits = 0;

    for (const doc of docs) {
      const dados = doc.data();
      if (migracao.incluir && !migracao.incluir(dados)) continue;

      elegiveis += 1;
      if (!APLICAR) continue;

      const destino = colecaoDoTenant(tenantDo(dados), migracao.destino).doc(doc.id);
      batch.set(destino, migracao.mapear(doc), { merge: true });
      pendentes += 1;

      if (pendentes >= 400) {
        await batch.commit();
        commits += 1;
        batch = db.batch();
        pendentes = 0;
      }
    }

    if (APLICAR && pendentes) {
      await batch.commit();
      commits += 1;
    }

    total += elegiveis;
    console.log(
      `  ${migracao.origem.padEnd(18)} -> ${migracao.destino.padEnd(12)} ${String(elegiveis).padStart(5)} registro(s)` +
        (APLICAR ? `, ${commits} lote(s)` : ' (dry-run)')
    );
  }

  return total;
}

(async () => {
  console.log(`\n== Migracao para subcolecoes por tenant (${APLICAR ? 'APLICAR' : 'DRY-RUN'}) ==\n`);
  const registros = await carregarOrigens();
  const tenantIds = new Set([TENANT_PADRAO]);
  registros.forEach(({ docs }) => docs.forEach((doc) => tenantIds.add(tenantDo(doc.data()))));

  console.log(`${tenantIds.size} tenant(s) identificado(s).`);
  await garantirTenants(tenantIds);
  const total = await copiarRegistros(registros);
  console.log(`\nConcluido: ${total} documento(s) ${APLICAR ? 'copiado(s)' : 'seriam copiados'}.`);
})().catch((error) => {
  console.error('\nFalha na migracao:', error.message);
  process.exitCode = 1;
});
