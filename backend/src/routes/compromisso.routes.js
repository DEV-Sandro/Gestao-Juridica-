const express = require('express');
const controller = require('../controllers/compromisso.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { roleMiddleware } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'ADVOGADO'));

router.get('/agenda', controller.listarAgenda);

router.post('/compromissos', controller.criar);
router.get('/compromissos/:id', controller.buscarPorId);
router.put('/compromissos/:id', controller.atualizar);
router.delete('/compromissos/:id', controller.deletar);

module.exports = router;
