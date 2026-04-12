const usuarioService = require('../services/usuario.service');

async function obterMeuPerfil(req, res, next) {
  try {
    const perfil = await usuarioService.obterPerfil(req.user);
    res.json(perfil);
  } catch (err) {
    next(err);
  }
}

async function atualizarMeuPerfil(req, res, next) {
  try {
    const perfil = await usuarioService.atualizarMeuPerfil(req.user, req.body);
    res.json(perfil);
  } catch (err) {
    next(err);
  }
}

async function uploadMeuAvatar(req, res, next) {
  try {
    const perfil = await usuarioService.uploadMeuAvatar(req.user, {
      buffer: req.body,
      contentType: req.headers['content-type'],
      originalName: req.headers['x-file-name']
    });
    res.status(201).json(perfil);
  } catch (err) {
    next(err);
  }
}

async function removerMeuAvatar(req, res, next) {
  try {
    const perfil = await usuarioService.removerMeuAvatar(req.user);
    res.json(perfil);
  } catch (err) {
    next(err);
  }
}

async function listarEquipe(req, res, next) {
  try {
    const equipe = await usuarioService.listarEquipe();
    res.json(equipe);
  } catch (err) {
    next(err);
  }
}

async function convidarMembro(req, res, next) {
  try {
    const resultado = await usuarioService.convidarMembro(req.user, req.body);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function atualizarRole(req, res, next) {
  try {
    const atualizado = await usuarioService.atualizarRole(req.params.uid, req.body.role);
    res.json(atualizado);
  } catch (err) {
    next(err);
  }
}

async function removerMembro(req, res, next) {
  try {
    await usuarioService.removerMembro(req.params.uid, req.user);
    res.json({ mensagem: 'Membro removido' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  obterMeuPerfil,
  atualizarMeuPerfil,
  uploadMeuAvatar,
  removerMeuAvatar,
  listarEquipe,
  convidarMembro,
  atualizarRole,
  removerMembro
};
