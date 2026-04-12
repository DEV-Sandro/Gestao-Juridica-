const express = require('express');
const controller = require('../controllers/cliente.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { roleMiddleware } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'ADVOGADO'));

router.get('/clientes', controller.listarClientes);
router.post('/clientes', controller.criarCliente);
router.put('/clientes/:id', controller.atualizarCliente);
router.delete('/clientes/:id', controller.arquivarCliente);

module.exports = router;
