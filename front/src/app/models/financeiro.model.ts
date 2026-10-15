export type LancamentoTipo = 'HONORARIO' | 'DESPESA' | 'REEMBOLSO';
export type LancamentoStatus = 'PENDENTE' | 'ATRASADO' | 'PAGO' | 'CANCELADO';

export interface LancamentoFinanceiro {
  id: string;
  descricao: string;
  tipo: LancamentoTipo;
  valor: number;
  vencimento: string;
  status: 'PENDENTE' | 'PAGO' | 'CANCELADO';
  statusEfetivo: LancamentoStatus;
  pagoEm?: string | null;
  valorPago?: number | null;
  parcela?: number;
  totalParcelas?: number;
  processoId?: string | null;
  processoTitulo?: string | null;
  clienteNome?: string | null;
  formaPagamento?: string | null;
}

export interface ResumoFinanceiro {
  recebidoNoMes: number;
  aReceber: number;
  atrasado: number;
  previstoNoMes: number;
  despesasNoMes: number;
  totalAtrasados: number;
  totalPendentes: number;
}

export interface ApontamentoHoras {
  id: string;
  processoId: string;
  processoTitulo: string;
  clienteNome?: string | null;
  descricao: string;
  data: string;
  minutos: number;
  valorHora: number;
  custoHora: number;
  advogadoId: string;
  advogadoNome: string;
}
