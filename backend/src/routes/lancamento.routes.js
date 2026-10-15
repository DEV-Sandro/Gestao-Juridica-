const express = require('express');
const controller = require('../controllers/lancamento.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { roleMiddleware } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'ADVOGADO'));

router.get('/lancamentos', controller.listar);
router.get('/financeiro/resumo', controller.resumo);

// Escrita: apenas ADMIN e ADVOGADO.
router.post('/lancamentos', controller.criar);
router.put('/lancamentos/:id', controller.atualizar);
router.delete('/lancamentos/:id', controller.deletar);

module.exports = router;
