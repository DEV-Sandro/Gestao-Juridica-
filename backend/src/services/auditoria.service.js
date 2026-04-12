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
    detalhes
  });
}

module.exports = {
  registrarEvento
};
