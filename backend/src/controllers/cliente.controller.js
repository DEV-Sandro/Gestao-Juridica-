const clienteService = require('../services/cliente.service');

async function listarClientes(req, res, next) {
  try {
    const clientes = await clienteService.listarClientes();
    res.json(clientes);
  } catch (err) {
    next(err);
  }
}

async function criarCliente(req, res, next) {
  try {
    const cliente = await clienteService.criarCliente(req.body, req.user);
    res.status(201).json(cliente);
  } catch (err) {
    next(err);
  }
}

async function atualizarCliente(req, res, next) {
  try {
    const cliente = await clienteService.atualizarCliente(req.params.id, req.body, req.user);
    res.json(cliente);
  } catch (err) {
    next(err);
  }
}

async function arquivarCliente(req, res, next) {
  try {
    const resultado = await clienteService.arquivarCliente(req.params.id, req.user);
    res.json({
      mensagem: 'Cliente inativado com seguranca.',
      ...resultado
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listarClientes,
  criarCliente,
  atualizarCliente,
  arquivarCliente
};
