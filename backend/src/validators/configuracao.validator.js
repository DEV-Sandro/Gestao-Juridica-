const { z } = require('zod');

// Esquemas conhecidos por chave de configuracao. Chaves novas (ex.: futuras
// listas de situacao/tags do produto) nao precisam de um schema aqui para
// funcionar — caem no validador generico abaixo, que so exige um objeto plano.
const schemaArquivamento = z.object({
  dias: z.number({ message: 'Informe o numero de dias para arquivamento.' }).int().positive().max(3650)
});

const schemaHonorarios = z.object({
  linksOAB: z.record(z.string(), z.string())
});

const schemaSituacoesProcesso = z.object({
  opcoes: z.array(
    z.object({
      value: z.string().trim().min(1).max(60),
      label: z.string().trim().min(1).max(80),
      ativo: z.boolean()
    })
  )
});

const SCHEMAS_POR_ID = {
  arquivamento: schemaArquivamento,
  honorarios: schemaHonorarios,
  situacoesProcesso: schemaSituacoesProcesso
};

function validarConfiguracao(id, dados) {
  const schema = SCHEMAS_POR_ID[id];

  if (!schema) {
    if (typeof dados !== 'object' || dados === null || Array.isArray(dados)) {
      const erro = new Error('VALIDACAO_CONFIGURACAO');
      erro.details = ['A configuracao deve ser um objeto.'];
      throw erro;
    }

    return dados;
  }

  const resultado = schema.safeParse(dados);
  if (!resultado.success) {
    const erro = new Error('VALIDACAO_CONFIGURACAO');
    erro.details = resultado.error.issues.map((issue) => issue.message);
    throw erro;
  }

  return resultado.data;
}

module.exports = {
  validarConfiguracao
};
