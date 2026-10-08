const express = require('express');
const controller = require('../controllers/rentabilidade.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { roleMiddleware } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(authMiddleware, roleMiddleware('ADMIN', 'ADVOGADO'));

router.get('/rentabilidade', controller.obter);
router.post('/rentabilidade/processos/:processoId/apontamentos-tempo', controller.criarApontamento);
router.patch('/rentabilidade/apontamentos-tempo/:id', controller.atualizarApontamento);
router.delete('/rentabilidade/apontamentos-tempo/:id', controller.deletarApontamento);

module.exports = router;
