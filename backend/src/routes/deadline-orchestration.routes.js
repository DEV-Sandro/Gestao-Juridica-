const express = require('express');
const controller = require('../controllers/deadline-orchestration.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { roleMiddleware } = require('../middlewares/role.middleware');

const router = express.Router();

// Executado exclusivamente pelo Cloud Tasks. A assinatura compartilhada é
// validada no controller; o endpoint não aceita tokens do navegador.
router.post('/integracoes/prazos/tarefas', controller.executarTarefa);
router.get('/integracoes/prazos/status', authMiddleware, roleMiddleware('ADMIN', 'ADVOGADO'), controller.status);

module.exports = router;
