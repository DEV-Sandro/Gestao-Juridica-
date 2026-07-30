// Identidade de tenant (escritório) para o modelo multi-tenant.
//
// O sistema nasceu single-tenant (um único escritório). Esta constante é o tenant
// do escritório original; toda linha de dados existente é atribuída a ele no
// backfill, e usuários sem tenantId caem aqui durante a transição (fail-safe que
// mantém o app funcionando enquanto a Fase 1b — imposição de leitura — não entra).
//
// Escritórios novos recebem um tenantId gerado (ver tenant.service quando criado).
const TENANT_PADRAO = 'escritorio-principal';

// Verdadeiro se o documento pertence ao tenant informado. Documento sem tenantId
// (dado antigo criado antes do backfill/deploy) é tratado como do tenant padrão,
// para a transição não esconder dados do escritório original.
function mesmoTenant(doc, tenantId) {
  return (doc?.tenantId || TENANT_PADRAO) === tenantId;
}

module.exports = { TENANT_PADRAO, mesmoTenant };
