const auditoriaRepository = require('../repositories/auditoria.repository');

async function registrarEvento({
  acao,
  entidade,
  entidadeId = null,
  usuario = null,
  detalhes = {}
}) {
  await auditoriaRepository.registrar({
    acao,
    entidade,
    entidadeId,
    usuarioId: usuario?.uid || null,
    usuarioEmail: usuario?.email || null,
    usuarioNome: usuario?.displayName || null,
    perfil: usuario?.role || null,
    ip: usuario?.ip || null,
    userAgent: usuario?.userAgent || null,
    detalhes
  });
}

// Consulta administrativa global. entidade/usuarioId sao empurrados pro Firestore
// quando informados (mesma tecnica ja usada em listarPorEntidade); data (de/ate) e
// paginacao simples por "limite" acontecem em memoria — suficiente para o volume
// atual e evita depender de indices compostos que ainda nao existem no projeto.
async function listarAuditoria({ entidade, usuarioId, de, ate, limite } = {}) {
  const limiteNumero = Math.min(Math.max(Number(limite) || 100, 1), 500);
  const registros = await auditoriaRepository.listarRecentes({ entidade, usuarioId });

  const filtrados = registros.filter((registro) => {
    if (de && String(registro.criadoEm || '') < de) return false;
    if (ate && String(registro.criadoEm || '') > ate) return false;
    return true;
  });

  return filtrados.slice(0, limiteNumero);
}

module.exports = {
  registrarEvento,
  listarAuditoria
};
