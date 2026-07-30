const express = require('express');
const controller = require('../controllers/template.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { roleMiddleware } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(authMiddleware);

// Leitura/uso dos modelos: ADMIN e ADVOGADO (advogado gera documentos no dia a dia).
router.get('/templates', roleMiddleware('ADMIN', 'ADVOGADO'), controller.listar);
router.get('/templates/:id/arquivo', roleMiddleware('ADMIN', 'ADVOGADO'), controller.baixar);
router.get('/templates/:id/versoes', roleMiddleware('ADMIN', 'ADVOGADO'), controller.listarVersoes);

// Cadastro/manutencao de modelos: apenas ADMIN.
router.post('/templates', roleMiddleware('ADMIN'), controller.criar);
router.post('/templates/:id/versoes', roleMiddleware('ADMIN'), controller.adicionarVersao);
router.post('/templates/:id/duplicar', roleMiddleware('ADMIN'), controller.duplicar);
router.put('/templates/:id', roleMiddleware('ADMIN'), controller.atualizar);
router.delete('/templates/:id', roleMiddleware('ADMIN'), controller.inativar);

module.exports = router;
