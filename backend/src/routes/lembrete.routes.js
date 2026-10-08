const express = require('express');
const controller = require('../controllers/lembrete.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { roleMiddleware } = require('../middlewares/role.middleware');

const router = express.Router();

router.get('/integracoes/status', authMiddleware, roleMiddleware('ADMIN', 'ADVOGADO'), controller.status);
router.post('/integracoes/lembretes/processar', controller.processar);

module.exports = router;
