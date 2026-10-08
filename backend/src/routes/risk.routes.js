const express = require('express');
const controller = require('../controllers/risk.controller');

const router = express.Router();

// Endpoint interno para Cloud Scheduler. Nunca e exposto pela interface.
router.post('/integracoes/prazos/recalcular-risco', controller.recalcularRisco);

module.exports = router;
