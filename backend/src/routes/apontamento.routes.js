const express = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { roleMiddleware } = require('../middlewares/role.middleware');
const service = require('../services/apontamento.service');

const router = express.Router();
router.use(authMiddleware);
router.use(roleMiddleware('ADMIN', 'ADVOGADO'));

router.get('/apontamentos', async (req, res, next) => {
  try { res.json(await service.listar(req.query, req.user)); } catch (error) { next(error); }
});
router.post('/apontamentos', async (req, res, next) => {
  try { res.status(201).json(await service.criar(req.body, req.user)); } catch (error) { next(error); }
});
router.delete('/apontamentos/:id', async (req, res, next) => {
  try { await service.excluir(req.params.id, req.user); res.json({ mensagem: 'Horas removidas.' }); } catch (error) { next(error); }
});

module.exports = router;
