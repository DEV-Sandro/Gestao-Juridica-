const express = require('express');
const controller = require('../controllers/configuracao.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { roleMiddleware } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(authMiddleware);

// Leitura: ADMIN e ADVOGADO (listas como situacoes/tags sao usadas no dia a dia
// por qualquer advogado ao criar/filtrar processos). Escrita: só ADMIN.
router.get('/configuracoes', roleMiddleware('ADMIN', 'ADVOGADO'), controller.listar);
router.get('/configuracoes/:id', roleMiddleware('ADMIN', 'ADVOGADO'), controller.obter);
router.put('/configuracoes/:id', roleMiddleware('ADMIN'), controller.atualizar);

module.exports = router;
