const express = require('express');
const controller = require('../controllers/dashboard.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/dashboard', controller.obter);

module.exports = router;
