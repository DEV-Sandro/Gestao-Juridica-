const express = require('express');
const controller = require('../controllers/usuario.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { roleMiddleware } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Usuarios
 *   description: Perfil e gestão de equipe
 */

/**
 * @swagger
 * /api/me:
 *   get:
 *     summary: Retorna perfil do usuário logado
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 */
router.get('/me', controller.obterMeuPerfil);

/**
 * @swagger
 * /api/me:
 *   put:
 *     summary: Atualiza perfil do usuário logado (displayName, photoURL, telefone, cargo, oab)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 */
router.put('/me', controller.atualizarMeuPerfil);
router.post(
  '/me/avatar',
  express.raw({
    type: ['image/jpeg', 'image/png', 'image/webp'],
    limit: '5mb'
  }),
  controller.uploadMeuAvatar
);
router.delete('/me/avatar', controller.removerMeuAvatar);

/**
 * @swagger
 * /api/equipe:
 *   get:
 *     summary: Lista membros da equipe
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 */
router.get('/equipe', roleMiddleware('ADMIN', 'ADVOGADO'), controller.listarEquipe);

/**
 * @swagger
 * /api/equipe/convidar:
 *   post:
 *     summary: Convida novo membro para a equipe (ADMIN)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 */
router.post('/equipe/convidar', roleMiddleware('ADMIN'), controller.convidarMembro);

/**
 * @swagger
 * /api/equipe/{uid}/role:
 *   put:
 *     summary: Atualiza papel (role) de um membro (ADMIN)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 */
router.put('/equipe/:uid/role', roleMiddleware('ADMIN'), controller.atualizarRole);

/**
 * @swagger
 * /api/equipe/{uid}:
 *   delete:
 *     summary: Remove/desativa membro (ADMIN)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/equipe/:uid', roleMiddleware('ADMIN'), controller.removerMembro);

module.exports = router;
