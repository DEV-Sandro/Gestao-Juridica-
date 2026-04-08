const express = require('express');
const controller = require('../controllers/processo.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { roleMiddleware } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Processos
 *   description: Gestão de processos jurídicos
 */

/**
 * @swagger
 * /api/processos:
 *   get:
 *     summary: Lista processos
 *     tags: [Processos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista retornada com sucesso
 */
router.get('/', controller.listar);

/**
 * @swagger
 * /api/processos/{id}:
 *   get:
 *     summary: Busca um processo por ID
 *     tags: [Processos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:id', controller.buscarPorId);

/**
 * @swagger
 * /api/processos:
 *   post:
 *     summary: Cria um novo processo
 *     tags: [Processos]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', roleMiddleware('ADVOGADO', 'ADMIN'), controller.criar);

/**
 * @swagger
 * /api/processos/{id}:
 *   put:
 *     summary: Atualiza um processo
 *     tags: [Processos]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', roleMiddleware('ADVOGADO', 'ADMIN'), controller.atualizar);

/**
 * @swagger
 * /api/processos/{id}:
 *   delete:
 *     summary: Remove um processo logicamente
 *     tags: [Processos]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', roleMiddleware('ADVOGADO', 'ADMIN'), controller.deletar);

module.exports = router;