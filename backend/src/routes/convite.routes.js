const express = require('express');
const controller = require('../controllers/convite.controller');

const router = express.Router();

router.get('/convites/:token', controller.verificarConvite);
router.post('/convites/verificar-email', controller.verificarConvitePorEmail);
router.post('/convites/aceitar', controller.aceitarConvite);

module.exports = router;
