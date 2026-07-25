// Fundacao de permissoes granulares, independente do role (ADMIN/ADVOGADO/CLIENT).
// Hoje cobre as permissoes de agenda compartilhada entre advogados; novas chaves
// podem ser adicionadas a CHAVES_PERMITIDAS/DEFAULTS_POR_ROLE sem alterar o
// middleware nem os controllers que ja a consomem.

const CHAVES_PERMITIDAS = new Set(['agendaVerColegas', 'agendaVerDetalhesColegas']);

const DEFAULTS_POR_ROLE = {
  ADMIN: { agendaVerColegas: true, agendaVerDetalhesColegas: true },
  ADVOGADO: { agendaVerColegas: false, agendaVerDetalhesColegas: false },
  CLIENT: {}
};

function obterPermissoes(user) {
  // ADMIN sempre tem acesso total, independentemente do que estiver salvo no
  // documento — evita que um admin fique trancado fora de uma tela administrativa
  // por causa de um valor salvo incorretamente.
  if (user.role === 'ADMIN') {
    return { ...DEFAULTS_POR_ROLE.ADMIN };
  }

  const defaults = DEFAULTS_POR_ROLE[user.role] || {};
  return { ...defaults, ...(user.permissoes || {}) };
}

function possuiPermissao(user, chave) {
  return obterPermissoes(user)[chave] === true;
}

function defaultsParaRole(role) {
  return { ...(DEFAULTS_POR_ROLE[role] || {}) };
}

module.exports = {
  CHAVES_PERMITIDAS,
  obterPermissoes,
  possuiPermissao,
  defaultsParaRole
};
