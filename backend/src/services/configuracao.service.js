const configuracaoRepository = require('../repositories/configuracao.repository');
const auditoriaService = require('./auditoria.service');
const { validarConfiguracao } = require('../validators/configuracao.validator');

async function obterConfiguracao(id) {
  const dados = await configuracaoRepository.buscarPorId(id);
  return dados || {};
}

async function listarConfiguracoes() {
  return configuracaoRepository.listarTodas();
}

// Registro leve, sem auditoria (nao e uma alteracao administrativa, e um
// efeito colateral de uso normal — ex.: nova tag usada num processo).
async function registrarValoresUsados(id, campo, valores) {
  try {
    await configuracaoRepository.adicionarValoresArray(id, campo, valores);
  } catch (error) {
    console.error(`[configuracao.service] falha ao registrar valores usados em ${id}.${campo}`, error.message);
  }
}

async function atualizarConfiguracao(id, dados, user) {
  const payload = validarConfiguracao(id, dados);
  const anterior = await configuracaoRepository.buscarPorId(id);

  await configuracaoRepository.salvar(id, {
    ...payload,
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: user.uid
  });

  await auditoriaService.registrarEvento({
    acao: 'ATUALIZAR_CONFIGURACAO',
    entidade: 'CONFIGURACAO',
    entidadeId: id,
    usuario: user,
    detalhes: {
      anterior: anterior || null,
      novo: payload
    }
  });

  return configuracaoRepository.buscarPorId(id);
}

module.exports = {
  obterConfiguracao,
  listarConfiguracoes,
  atualizarConfiguracao,
  registrarValoresUsados
};
