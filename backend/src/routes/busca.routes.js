const express = require('express');
const controller = require('../controllers/busca.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/busca', controller.buscar);

module.exports = router;
