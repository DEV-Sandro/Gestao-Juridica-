const express = require('express');
const controller = require('../controllers/lancamento.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { roleMiddleware } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(authMiddleware);

// Leitura: CLIENT tambem acessa (ve apenas os proprios lancamentos, filtrados no service).
router.get('/lancamentos', controller.listar);
router.get('/financeiro/resumo', roleMiddleware('ADMIN', 'ADVOGADO'), controller.resumo);

// Escrita: apenas ADMIN e ADVOGADO.
router.post('/lancamentos', roleMiddleware('ADMIN', 'ADVOGADO'), controller.criar);
router.put('/lancamentos/:id', roleMiddleware('ADMIN', 'ADVOGADO'), controller.atualizar);
router.delete('/lancamentos/:id', roleMiddleware('ADMIN', 'ADVOGADO'), controller.deletar);

module.exports = router;
