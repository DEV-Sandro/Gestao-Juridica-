export interface ClienteRecord {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  documentoSecundario: string | null;
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
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  observacoes?: string | null;
}
