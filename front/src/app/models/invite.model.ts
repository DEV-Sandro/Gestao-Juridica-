export interface InviteSummary {
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED' | 'INVALID' | 'NOT_FOUND';
  hasInvite?: boolean;
  email?: string;
  displayName?: string;
  role?: string;
  cargo?: string | null;
  oab?: string | null;
  expiresAt?: string;
  canAccept?: boolean;
}

export interface InviteAcceptancePayload {
  token: string;
  password: string;
  displayName: string;
  telefone?: string | null;
  cargo?: string | null;
  oab?: string | null;
}

export interface InviteAcceptanceResult {
  mensagem: string;
  email: string;
  displayName: string;
}

export interface InviteCreateResponse {
  mensagem: string;
  email: string;
  acceptUrl: string;
  expiresAt: string;
}
