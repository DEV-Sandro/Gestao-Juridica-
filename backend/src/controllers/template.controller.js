const templateService = require('../services/template.service');

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function listar(req, res, next) {
  try {
    const templates = await templateService.listarTemplates();
    res.json(templates);
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const template = await templateService.criarTemplate(req.body, req.user);
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
}

async function adicionarVersao(req, res, next) {
  try {
    const template = await templateService.adicionarVersaoTemplate(req.params.id, req.body, req.user);
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
}

async function listarVersoes(req, res, next) {
  try {
    const versoes = await templateService.listarVersoes(req.params.id);
    res.json(versoes);
  } catch (err) {
    next(err);
  }
}

async function baixar(req, res, next) {
  try {
    const { buffer, nome } = await templateService.baixarTemplate(req.params.id);
    res.setHeader('Content-Type', MIME_DOCX);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nome)}.docx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function inativar(req, res, next) {
  try {
    await templateService.inativarTemplate(req.params.id, req.user);
    res.json({ mensagem: 'Modelo removido com sucesso' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  criar,
  adicionarVersao,
  listarVersoes,
  baixar,
  inativar
};
