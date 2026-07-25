export type EstadoCivil =
  | 'SOLTEIRO'
  | 'CASADO'
  | 'DIVORCIADO'
  | 'VIUVO'
  | 'UNIAO_ESTAVEL'
  | 'SEPARADO_JUDICIALMENTE';

export interface OpcaoEstadoCivil {
  value: EstadoCivil;
  label: string;
}

// Lista centralizada: para adicionar um novo estado civil, basta incluir um item aqui.
export const ESTADO_CIVIL_OPTIONS: OpcaoEstadoCivil[] = [
  { value: 'SOLTEIRO', label: 'Solteiro(a)' },
  { value: 'CASADO', label: 'Casado(a)' },
  { value: 'DIVORCIADO', label: 'Divorciado(a)' },
  { value: 'VIUVO', label: 'Viúvo(a)' },
  { value: 'UNIAO_ESTAVEL', label: 'União estável' },
  { value: 'SEPARADO_JUDICIALMENTE', label: 'Separado(a) judicialmente' }
];

export function labelEstadoCivil(valor?: string | null): string {
  if (!valor) return 'Não informado';
  return ESTADO_CIVIL_OPTIONS.find((opcao) => opcao.value === valor)?.label || valor;
}

export interface ClienteRecord {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  documentoSecundario: string | null;
  estadoCivil: EstadoCivil | null;
  nacionalidade: string | null;
  profissao: string | null;
  rg: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  observacoes: string | null;
  ativo: boolean;
  criadoEm: string | null;
  atualizadoEm: string | null;
}

export interface ClientePayload {
  nome: string;
  cpf?: string | null;
  email?: string | null;
  telefone?: string | null;
  documentoSecundario?: string | null;
  estadoCivil?: EstadoCivil | null;
  nacionalidade?: string | null;
  profissao?: string | null;
  rg?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  observacoes?: string | null;
}
