const express = require('express');
const controller = require('../controllers/auth.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Autenticação
 */

/**
 * @swagger
 * /api/login-seguro:
 *   post:
 *     summary: Valida token Firebase e retorna dados do usuário
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 example: eyJhbGciOiJSUzI1NiIsImtpZCI6...
 *     responses:
 *       200:
 *         description: Token validado com sucesso
 *       401:
 *         description: Token obrigatório
 *       403:
 *         description: Token inválido
 */
router.post('/login-seguro', controller.loginSeguro);

module.exports = router;