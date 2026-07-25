export type UserRole = 'ADMIN' | 'ADVOGADO' | 'CLIENT';

export interface PermissoesUsuario {
  agendaVerColegas?: boolean;
  agendaVerDetalhesColegas?: boolean;
}

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  telefone?: string | null;
  cargo?: string | null;
  oab?: string | null;
  criadoEm?: string | null;
  ativo?: boolean;
  permissoes?: PermissoesUsuario;
}

export interface ConviteMembroPayload {
  email: string;
  displayName: string;
  role: UserRole;
  cargo?: string;
  oab?: string;
}
