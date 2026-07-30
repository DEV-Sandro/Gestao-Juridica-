// Migração one-shot: multi-tenant Fase 1a.
//
// Cria o documento do escritório original em `tenants/` e carimba `tenantId` em
// todos os documentos existentes das coleções de dados. Idempotente: só grava
// onde o campo ainda não existe. Aditivo e reversível (não altera outros campos).
//
// Uso:  node scripts/backfill-tenant.js            (dry-run: só conta)
//       node scripts/backfill-tenant.js --apply    (grava de verdade)

const { db } = require('../src/config/firebase');
const { TENANT_PADRAO } = require('../src/config/tenant');

const APLICAR = process.argv.includes('--apply');

// Coleções de topo que carregam dados de escritório. Subcoleções (etapas sob
// processos, versoes sob templates) herdam o escopo do pai e não precisam do campo.
const COLECOES = [
  'usuarios',
  'clientes',
  'processos',
  'compromissos',
  'lancamentos',
  'templates',
  'auditoria',
  'convitesEquipe',
  'configuracoes'
];

async function carimbarColecao(nome) {
  const snap = await db.collection(nome).get();
  let semTenant = 0;
  let lote = db.batch();
  let naFila = 0;
  let commits = 0;

  for (const doc of snap.docs) {
    if (doc.get('tenantId')) continue;
    semTenant++;
    if (APLICAR) {
      lote.update(doc.ref, { tenantId: TENANT_PADRAO });
      naFila++;
      if (naFila >= 400) {
        await lote.commit();
        commits++;
        lote = db.batch();
        naFila = 0;
      }
    }
  }
  if (APLICAR && naFila > 0) {
    await lote.commit();
    commits++;
  }

  console.log(
    `  ${nome.padEnd(16)} total=${String(snap.size).padStart(5)}  sem tenantId=${String(semTenant).padStart(5)}` +
      (APLICAR ? `  → carimbados (${commits} lote(s))` : '  (dry-run)')
  );
  return semTenant;
}

async function garantirTenant() {
  const ref = db.collection('tenants').doc(TENANT_PADRAO);
  const doc = await ref.get();
  if (doc.exists) {
    console.log(`  tenants/${TENANT_PADRAO}: já existe`);
    return;
  }
  if (APLICAR) {
    await ref.set({
      nome: 'Escritório principal',
      criadoEm: new Date().toISOString(),
      ativo: true,
      plano: 'fundador',
      origem: 'backfill-fase-1a'
    });
    console.log(`  tenants/${TENANT_PADRAO}: criado`);
  } else {
    console.log(`  tenants/${TENANT_PADRAO}: seria criado (dry-run)`);
  }
}

(async () => {
  console.log(`\n== Backfill multi-tenant (tenant padrão: ${TENANT_PADRAO}) ==`);
  console.log(APLICAR ? 'MODO: APLICAR (gravando)\n' : 'MODO: DRY-RUN (só contagem — use --apply para gravar)\n');

  await garantirTenant();
  console.log('');

  let totalPendente = 0;
  for (const nome of COLECOES) {
    try {
      totalPendente += await carimbarColecao(nome);
    } catch (e) {
      console.log(`  ${nome.padEnd(16)} ERRO: ${e.message}`);
    }
  }

  console.log(
    `\n${APLICAR ? 'Concluído.' : `Dry-run concluído — ${totalPendente} documento(s) receberiam tenantId.`}\n`
  );
  process.exit(0);
})();
