// Verificação de isolamento multi-tenant (Fase 1b).
//
// Cria dados temporários de um 2º tenant fictício e confirma que:
//   (a) o tenant original NÃO enxerga os dados do 2º tenant;
//   (b) o 2º tenant enxerga SOMENTE os próprios.
// Ao final, remove os dados temporários. Não altera nada permanente.
//
// Uso: node scripts/verify-tenant-isolation.js

const { db } = require('../src/config/firebase');
const { TENANT_PADRAO } = require('../src/config/tenant');
const { runComTenant } = require('../src/config/tenant-context');
const clienteService = require('../src/services/cliente.service');
const processoService = require('../src/services/processo.service');

const TENANT_B = 'tenant-teste-isolamento-b';
const MARCA = '__ISOLAMENTO_TESTE__';

let ok = 0;
let falhou = 0;
function checa(descricao, condicao) {
  if (condicao) {
    ok++;
    console.log(`  ✓ ${descricao}`);
  } else {
    falhou++;
    console.log(`  ✗ FALHOU: ${descricao}`);
  }
}

async function seed() {
  const clienteRef = await db.collection('clientes').add({
    nome: `${MARCA} Cliente do Tenant B`,
    ativo: true,
    tenantId: TENANT_B,
    criadoEm: new Date().toISOString()
  });
  const processoRef = await db.collection('processos').add({
    titulo: `${MARCA} Processo do Tenant B`,
    clienteId: clienteRef.id,
    advogadoId: 'adv-b',
    status: 'Em Andamento',
    deletado: false,
    tenantId: TENANT_B,
    criadoEm: new Date().toISOString()
  });
  return { clienteId: clienteRef.id, processoId: processoRef.id };
}

async function limpar(ids) {
  await db.collection('clientes').doc(ids.clienteId).delete();
  await db.collection('processos').doc(ids.processoId).delete();
}

(async () => {
  console.log('\n== Verificação de isolamento multi-tenant ==\n');
  const ids = await seed();

  try {
    // ---- Clientes (usa tenantAtual via AsyncLocalStorage) ----
    const clientesA = await runComTenant(TENANT_PADRAO, () => clienteService.listarClientes());
    const clientesB = await runComTenant(TENANT_B, () => clienteService.listarClientes());

    console.log('Clientes:');
    checa(
      'tenant original NÃO vê o cliente do tenant B',
      !clientesA.some((c) => c.id === ids.clienteId)
    );
    checa(
      'tenant B vê o próprio cliente',
      clientesB.some((c) => c.id === ids.clienteId)
    );
    checa(
      'tenant B vê SOMENTE os próprios clientes',
      clientesB.length > 0 && clientesB.every((c) => c.id === ids.clienteId)
    );

    // ---- Processos (usa user.tenantId) ----
    const userA = { uid: 'admin-a', role: 'ADMIN', tenantId: TENANT_PADRAO };
    const userB = { uid: 'admin-b', role: 'ADMIN', tenantId: TENANT_B };
    const procsA = await runComTenant(TENANT_PADRAO, () => processoService.listarProcessos({}, userA));
    const procsB = await runComTenant(TENANT_B, () => processoService.listarProcessos({}, userB));

    console.log('\nProcessos:');
    checa(
      'tenant original NÃO vê o processo do tenant B',
      !procsA.some((p) => p.id === ids.processoId)
    );
    checa(
      'tenant B vê SOMENTE o próprio processo',
      procsB.length === 1 && procsB[0].id === ids.processoId
    );
  } catch (e) {
    falhou++;
    console.log('  ✗ ERRO durante a verificação:', e.message);
  } finally {
    await limpar(ids);
    console.log('\n(dados temporários removidos)');
  }

  console.log(`\nResultado: ${ok} ok, ${falhou} falha(s).`);
  console.log(falhou === 0 ? '✅ ISOLAMENTO CONFIRMADO\n' : '❌ ISOLAMENTO FALHOU — revisar\n');
  process.exit(falhou === 0 ? 0 : 1);
})();
