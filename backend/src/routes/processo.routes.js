const express = require('express');
const controller = require('../controllers/processo.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { roleMiddleware } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.get('/:id/historico', controller.listarHistorico);
router.get('/:id/etapas', controller.listarEtapas);

router.post('/', roleMiddleware('ADVOGADO', 'ADMIN'), controller.criar);
router.put('/:id', roleMiddleware('ADVOGADO', 'ADMIN'), controller.atualizar);
router.put('/:id/orcamento', roleMiddleware('ADVOGADO', 'ADMIN'), controller.atualizarOrcamento);
router.post(
  '/:id/orcamento/converter-contrato',
  roleMiddleware('ADVOGADO', 'ADMIN'),
  controller.converterOrcamentoEmContrato
);
router.post(
  '/:id/documentos/registrar',
  roleMiddleware('ADVOGADO', 'ADMIN'),
  controller.registrarDocumentoGerado
);
router.delete('/:id', roleMiddleware('ADVOGADO', 'ADMIN'), controller.deletar);

router.post('/:id/etapas', roleMiddleware('ADVOGADO', 'ADMIN'), controller.criarEtapa);
router.put(
  '/:id/etapas/:etapaId',
  roleMiddleware('ADVOGADO', 'ADMIN'),
  controller.atualizarEtapa
);
router.delete('/:id/etapas/:etapaId', roleMiddleware('ADVOGADO', 'ADMIN'), controller.deletarEtapa);

module.exports = router;
