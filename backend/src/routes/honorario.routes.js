const express = require('express');
const controller = require('../controllers/honorario.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { roleMiddleware } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'ADVOGADO'));

router.get('/honorarios', controller.listar);

module.exports = router;
