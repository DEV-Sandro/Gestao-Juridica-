const { z } = require('zod');

const criarProcessoSchema = z.object({
  titulo: z.string()
    .min(3, 'Título muito curto')
    .max(150, 'Título muito longo'),

  descricao: z.string()
    .max(5000)
    .optional(),

  clienteId: z.string()
    .min(1, 'Cliente obrigatório'),

  advogadoId: z.string()
    .optional(),

  prazo: z.string()
    .datetime({ message: 'Formato de data inválido' })
    .optional()
});

module.exports = {
  criarProcessoSchema
};