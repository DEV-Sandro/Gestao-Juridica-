function ok(res, data = {}, mensagem = 'Operação realizada com sucesso') {
  return res.status(200).json({
    sucesso: true,
    mensagem,
    data
  });
}

function created(res, data = {}, mensagem = 'Registro criado com sucesso') {
  return res.status(201).json({
    sucesso: true,
    mensagem,
    data
  });
}

function fail(res, status = 400, mensagem = 'Falha na operação') {
  return res.status(status).json({
    sucesso: false,
    mensagem
  });
}

module.exports = {
  ok,
  created,
  fail
};