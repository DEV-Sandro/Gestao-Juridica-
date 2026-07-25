// Listas centralizadas de Categoria e Tipo de Causa dos processos.
// Para adicionar uma nova opcao no futuro, basta incluir um item nestes arrays —
// nenhuma outra tela ou regra de negocio precisa ser alterada.

export interface OpcaoClassificacao {
  value: string;
  label: string;
}

export const CATEGORIAS_PROCESSO: OpcaoClassificacao[] = [
  { value: 'CIVEL', label: 'Cível' },
  { value: 'TRABALHISTA', label: 'Trabalhista' },
  { value: 'FAMILIA', label: 'Família' },
  { value: 'CRIMINAL', label: 'Criminal' },
  { value: 'TRIBUTARIO', label: 'Tributário' },
  { value: 'PREVIDENCIARIO', label: 'Previdenciário' },
  { value: 'CONSUMIDOR', label: 'Consumidor' },
  { value: 'EMPRESARIAL', label: 'Empresarial' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo' },
  { value: 'OUTRA', label: 'Outra' }
];

export const TIPOS_CAUSA: OpcaoClassificacao[] = [
  { value: 'COBRANCA', label: 'Cobrança' },
  { value: 'INDENIZATORIA', label: 'Indenizatória' },
  { value: 'RESCISAO_CONTRATUAL', label: 'Rescisão contratual' },
  { value: 'DIVORCIO', label: 'Divórcio' },
  { value: 'PENSAO_ALIMENTICIA', label: 'Pensão alimentícia' },
  { value: 'INVENTARIO', label: 'Inventário' },
  { value: 'RESCISAO_TRABALHISTA', label: 'Rescisão trabalhista' },
  { value: 'ACIDENTE_TRABALHO', label: 'Acidente de trabalho' },
  { value: 'APOSENTADORIA', label: 'Aposentadoria' },
  { value: 'EXECUCAO_FISCAL', label: 'Execução fiscal' },
  { value: 'OUTRO', label: 'Outro' }
];

export function labelClassificacao(
  lista: OpcaoClassificacao[],
  value?: string | null
): string {
  if (!value) return 'Não informado';
  return lista.find((opcao) => opcao.value === value)?.label || value;
}
