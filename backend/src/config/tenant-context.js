const { AsyncLocalStorage } = require('async_hooks');
const { TENANT_PADRAO } = require('./tenant');

// Contexto de tenant por requisição. O auth.middleware executa o restante da
// requisição dentro de runComTenant(...), e qualquer service/repository lê o
// tenant atual com tenantAtual() — sem precisar receber tenantId por parâmetro.
// Assim é impossível "esquecer" de escopar uma leitura (a causa nº 1 de vazamento
// em multi-tenant). Fora de uma requisição (scripts, jobs) cai no tenant padrão.
const als = new AsyncLocalStorage();

function runComTenant(tenantId, fn) {
  return als.run({ tenantId: tenantId || TENANT_PADRAO }, fn);
}

function tenantAtual() {
  const store = als.getStore();
  return (store && store.tenantId) || TENANT_PADRAO;
}

module.exports = { runComTenant, tenantAtual };
