export type UserRole = 'ADMIN' | 'ADVOGADO' | 'CLIENT';

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
}

export interface ConviteMembroPayload {
  email: string;
  displayName: string;
  role: UserRole;
  cargo?: string;
  oab?: string;
}
