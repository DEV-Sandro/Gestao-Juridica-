const service = require('../services/processo.service');

async function listar(req, res, next) {
  try {
    const data = await service.listarProcessos(req.query, req.user);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function buscarPorId(req, res, next) {
  try {
    const data = await service.buscarPorId(req.params.id, req.user);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const id = await service.criarProcesso(req.body, req.user);

    res.status(201).json({
      mensagem: 'Processo criado com sucesso',
      id
    });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    await service.atualizarProcesso(req.params.id, req.body, req.user);

    res.json({
      mensagem: 'Processo atualizado com sucesso'
    });
  } catch (err) {
    next(err);
  }
}

async function deletar(req, res, next) {
  try {
    await service.deletarProcesso(req.params.id, req.user);

    res.json({
      mensagem: 'Processo removido com sucesso'
    });
  } catch (err) {
    next(err);
  }
}

async function listarEtapas(req, res, next) {
  try {
    const etapas = await service.listarEtapas(req.params.id, req.user);
    res.json(etapas);
  } catch (err) {
    next(err);
  }
}

async function criarEtapa(req, res, next) {
  try {
    const etapa = await service.criarEtapa(req.params.id, req.body, req.user);
    res.status(201).json(etapa);
  } catch (err) {
    next(err);
  }
}

async function atualizarEtapa(req, res, next) {
  try {
    const etapa = await service.atualizarEtapa(req.params.id, req.params.etapaId, req.body, req.user);
    res.json(etapa);
  } catch (err) {
    next(err);
  }
}

async function deletarEtapa(req, res, next) {
  try {
    await service.deletarEtapa(req.params.id, req.params.etapaId, req.user);
    res.json({ mensagem: 'Etapa removida com sucesso' });
  } catch (err) {
    next(err);
  }
}

async function listarHistorico(req, res, next) {
  try {
    const registros = await service.listarHistorico(req.params.id, req.user);
    res.json(registros);
  } catch (err) {
    next(err);
  }
}

async function atualizarOrcamento(req, res, next) {
  try {
    const orcamento = await service.atualizarOrcamento(req.params.id, req.body, req.user);
    res.json(orcamento);
  } catch (err) {
    next(err);
  }
}

async function converterOrcamentoEmContrato(req, res, next) {
  try {
    const orcamento = await service.converterOrcamentoEmContrato(
      req.params.id,
      req.body,
      req.user
    );
    res.json(orcamento);
  } catch (err) {
    next(err);
  }
}

async function registrarDocumentoGerado(req, res, next) {
  try {
    const resultado = await service.registrarDocumentoGerado(req.params.id, req.body, req.user);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  buscarPorId,
  criar,
  atualizar,
  deletar,
  listarEtapas,
  criarEtapa,
  atualizarEtapa,
  deletarEtapa,
  listarHistorico,
  atualizarOrcamento,
  converterOrcamentoEmContrato,
  registrarDocumentoGerado
};
