import { Injectable, inject } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User as FirebaseUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from '@angular/fire/auth';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

import { environment } from '../environments/environment';
import { AppUser, ConviteMembroPayload, UserRole } from './models/app-user.model';
import { ClientePayload, ClienteRecord } from './models/client.model';
import { CompromissoApiModel, ConflitoCompromisso } from './shared/processo-ui';
import {
  InviteAcceptancePayload,
  InviteAcceptanceResult,
  InviteCreateResponse,
  InviteSummary
} from './models/invite.model';

export interface ResultadoBusca {
  termo: string;
  processos: {
    id: string;
    titulo: string;
    cliente: string | null;
    status: string | null;
    prazo: string | null;
  }[];
  clientes: {
    id: string;
    nome: string;
    cpf: string | null;
    email: string | null;
    telefone: string | null;
  }[];
}

export type LancamentoTipo = 'HONORARIO' | 'DESPESA' | 'REEMBOLSO';
export type LancamentoStatus = 'PENDENTE' | 'PAGO' | 'CANCELADO' | 'ATRASADO';

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
  clienteId?: string | null;
  clienteNome?: string | null;
  formaPagamento?: string | null;
  observacao?: string | null;
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

export interface DashboardResumo {
  geradoEm: string;
  processos: {
    ativos: number;
    dataFatal: number;
    urgentes: number;
    concluidos: number;
    vencendoHoje: number;
    porArea: Record<string, number>;
    porSituacao: Record<string, number>;
  };
  prazosCriticos: {
    id: string;
    titulo: string;
    cliente: string | null;
    prazo: string;
    status: string;
    diasParaPrazo: number | null;
  }[];
  agenda: {
    hoje: number;
    proximosSete: number;
    itensDoDia: { id: string; titulo: string; dataInicio: string; tipo: string; local: string | null }[];
  };
  financeiro: ResumoFinanceiro | null;
}

export interface TemplateDocumento {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  tipo: string | null;
  versaoAtual: number;
  variaveis: string[];
  ativo: boolean;
  criadoEm: string | null;
  atualizadoEm: string | null;
}

export interface AuditoriaRegistro {
  id: string;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  usuarioId: string | null;
  usuarioEmail: string | null;
  usuarioNome: string | null;
  perfil: string | null;
  ip: string | null;
  userAgent: string | null;
  detalhes: Record<string, unknown>;
  criadoEm: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);
  private http = inject(HttpClient);

  private apiUrl = environment.apiUrl;

  private currentUserSubject = new BehaviorSubject<AppUser | null>(null);
  readonly currentUser$: Observable<AppUser | null> = this.currentUserSubject.asObservable();

  constructor() {
    onAuthStateChanged(this.auth, async (fbUser) => {
      if (!fbUser) {
        this.currentUserSubject.next(null);
        return;
      }

      this.currentUserSubject.next(this.fromFirebaseUser(fbUser));

      try {
        await this.carregarPerfilDoBackend();
      } catch (err) {
        console.error('[AuthService] Falha ao carregar perfil do backend', err);
      }
    });
  }

  get currentUser(): AppUser | null {
    return this.currentUserSubject.value;
  }

  private fromFirebaseUser(fb: FirebaseUser): AppUser {
    return {
      uid: fb.uid,
      email: fb.email,
      displayName: fb.displayName,
      photoURL: fb.photoURL,
      role: 'CLIENT'
    };
  }

  async loginEmail(email: string, pass: string) {
    await signInWithEmailAndPassword(this.auth, email, pass);
  }

  async loginGoogle() {
    await signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  // Envia o e-mail de redefinicao de senha pelo proprio Firebase Auth (que gera o
  // link seguro, valida o token e expira sozinho — nao guardamos nada disso).
  // Erros de "usuario nao encontrado" sao engolidos de proposito pelo chamador
  // para nao permitir descobrir quais e-mails existem na base.
  async enviarResetSenha(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email.trim());
  }

  async getAuthToken(): Promise<string | null> {
    const user = this.auth.currentUser;
    return user ? await user.getIdToken() : null;
  }

  enviarTokenParaBackend(token: string) {
    return this.http.post<{ role: UserRole; uid: string; usuario: string }>(
      `${this.apiUrl}/api/login-seguro`,
      { token }
    );
  }

  async logout() {
    await signOut(this.auth);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  async carregarPerfilDoBackend(): Promise<AppUser | null> {
    const dados = await firstValueFrom(this.http.get<AppUser>(`${this.apiUrl}/api/me`));
    return this.aplicarPerfilRecebido(dados);
  }

  async atualizarMeuPerfil(dados: Partial<AppUser>): Promise<AppUser> {
    const atualizado = await firstValueFrom(this.http.put<AppUser>(`${this.apiUrl}/api/me`, dados));
    return this.aplicarPerfilRecebido(atualizado);
  }

  async aplicarPerfilRecebido(dados: AppUser): Promise<AppUser> {
    if (
      this.auth.currentUser &&
      (dados.displayName !== undefined || dados.photoURL !== undefined)
    ) {
      await updateProfile(this.auth.currentUser, {
        displayName:
          dados.displayName === undefined ? this.auth.currentUser.displayName : dados.displayName,
        photoURL:
          dados.photoURL === undefined ? this.auth.currentUser.photoURL : dados.photoURL
      });
    }

    const merged: AppUser = {
      ...(this.currentUserSubject.value ?? ({} as AppUser)),
      ...dados
    };
    this.currentUserSubject.next(merged);
    return merged;
  }

  listarEquipe() {
    return this.http.get<AppUser[]>(`${this.apiUrl}/api/equipe`);
  }

  convidarMembro(payload: ConviteMembroPayload) {
    return this.http.post<InviteCreateResponse>(
      `${this.apiUrl}/api/equipe/convidar`,
      payload
    );
  }

  atualizarRoleMembro(uid: string, role: UserRole) {
    return this.http.put<AppUser>(`${this.apiUrl}/api/equipe/${uid}/role`, { role });
  }

  atualizarPermissoesMembro(uid: string, permissoes: Record<string, boolean>) {
    return this.http.put<AppUser>(`${this.apiUrl}/api/equipe/${uid}/permissoes`, permissoes);
  }

  listarAuditoria(filtros: {
    entidade?: string;
    usuarioId?: string;
    de?: string;
    ate?: string;
    limite?: number;
  }) {
    let params = new HttpParams();
    Object.entries(filtros).forEach(([chave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(chave, String(valor));
      }
    });

    return this.http.get<AuditoriaRegistro[]>(`${this.apiUrl}/api/auditoria`, { params });
  }

  removerMembro(uid: string) {
    return this.http.delete(`${this.apiUrl}/api/equipe/${uid}`);
  }

  listarAgenda(filtros: { modo?: string; advogadoId?: string; de?: string; ate?: string }) {
    let params = new HttpParams();
    Object.entries(filtros).forEach(([chave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(chave, String(valor));
      }
    });

    return this.http.get<CompromissoApiModel[]>(`${this.apiUrl}/api/agenda`, { params });
  }

  criarCompromisso(dados: Partial<CompromissoApiModel>) {
    return this.http.post<{ id: string; conflitos: ConflitoCompromisso[] }>(
      `${this.apiUrl}/api/compromissos`,
      dados
    );
  }

  atualizarCompromisso(id: string, dados: Partial<CompromissoApiModel>) {
    return this.http.put<{ conflitos: ConflitoCompromisso[] }>(
      `${this.apiUrl}/api/compromissos/${id}`,
      dados
    );
  }

  excluirCompromisso(id: string) {
    return this.http.delete(`${this.apiUrl}/api/compromissos/${id}`);
  }

  buscarGlobal(termo: string) {
    return this.http.get<ResultadoBusca>(`${this.apiUrl}/api/busca`, {
      params: new HttpParams().set('q', termo)
    });
  }

  obterDashboard() {
    return this.http.get<DashboardResumo>(`${this.apiUrl}/api/dashboard`);
  }

  listarLancamentos(filtros: { processoId?: string; statusEfetivo?: string; de?: string; ate?: string } = {}) {
    let params = new HttpParams();
    Object.entries(filtros).forEach(([chave, valor]) => {
      if (valor) params = params.set(chave, String(valor));
    });
    return this.http.get<LancamentoFinanceiro[]>(`${this.apiUrl}/api/lancamentos`, { params });
  }

  obterResumoFinanceiro() {
    return this.http.get<ResumoFinanceiro>(`${this.apiUrl}/api/financeiro/resumo`);
  }

  criarLancamento(payload: {
    descricao: string;
    tipo?: LancamentoTipo;
    valor: string | number;
    vencimento: string;
    parcelas?: number;
    processoId?: string | null;
    formaPagamento?: string | null;
    observacao?: string | null;
  }) {
    return this.http.post<LancamentoFinanceiro[]>(`${this.apiUrl}/api/lancamentos`, payload);
  }

  atualizarLancamento(id: string, payload: Record<string, unknown>) {
    return this.http.put<LancamentoFinanceiro>(`${this.apiUrl}/api/lancamentos/${id}`, payload);
  }

  excluirLancamento(id: string) {
    return this.http.delete(`${this.apiUrl}/api/lancamentos/${id}`);
  }

  listarTemplates() {
    return this.http.get<TemplateDocumento[]>(`${this.apiUrl}/api/templates`);
  }

  criarTemplate(payload: {
    nome: string;
    descricao?: string | null;
    categoria?: string | null;
    tipo?: string | null;
    arquivoBase64: string;
  }) {
    return this.http.post<TemplateDocumento>(`${this.apiUrl}/api/templates`, payload);
  }

  adicionarVersaoTemplate(id: string, payload: { arquivoBase64: string; notas?: string | null }) {
    return this.http.post<TemplateDocumento>(`${this.apiUrl}/api/templates/${id}/versoes`, payload);
  }

  excluirTemplate(id: string) {
    return this.http.delete(`${this.apiUrl}/api/templates/${id}`);
  }

  baixarTemplateArquivo(id: string) {
    return this.http.get(`${this.apiUrl}/api/templates/${id}/arquivo`, {
      responseType: 'arraybuffer'
    });
  }

  listarProcessos() {
    return this.http.get(`${this.apiUrl}/api/processos`);
  }

  pegarProcessoPeloId(id: string) {
    return this.http.get(`${this.apiUrl}/api/processos/${id}`);
  }

  salvarProcesso(dados: any) {
    return this.http.post(`${this.apiUrl}/api/processos`, dados);
  }

  atualizarProcesso(id: string, dados: any) {
    return this.http.put(`${this.apiUrl}/api/processos/${id}`, dados);
  }

  excluirProcesso(id: string) {
    return this.http.delete(`${this.apiUrl}/api/processos/${id}`);
  }

  listarEtapas(procId: string) {
    return this.http.get(`${this.apiUrl}/api/processos/${procId}/etapas`);
  }

  criarEtapa(procId: string, dados: any) {
    return this.http.post(`${this.apiUrl}/api/processos/${procId}/etapas`, dados);
  }

  atualizarEtapa(procId: string, etapaId: string, dados: any) {
    return this.http.put(`${this.apiUrl}/api/processos/${procId}/etapas/${etapaId}`, dados);
  }

  atualizarStatusEtapa(procId: string, etapaId: string, status: string) {
    return this.atualizarEtapa(procId, etapaId, { status });
  }

  excluirEtapa(procId: string, etapaId: string) {
    return this.http.delete(`${this.apiUrl}/api/processos/${procId}/etapas/${etapaId}`);
  }

  listarHistoricoProcesso(procId: string) {
    return this.http.get(`${this.apiUrl}/api/processos/${procId}/historico`);
  }

  pegarTabelasOAB() {
    return this.http.get<Record<string, string>>(`${this.apiUrl}/api/honorarios`);
  }

  listarSituacoesProcesso() {
    return this.http.get<{ opcoes?: { value: string; label: string; ativo: boolean }[] }>(
      `${this.apiUrl}/api/configuracoes/situacoesProcesso`
    );
  }

  listarTagsUsadas() {
    return this.http.get<{ valores?: string[] }>(`${this.apiUrl}/api/configuracoes/tagsUsadas`);
  }

  listarClientes() {
    return this.http.get<ClienteRecord[]>(`${this.apiUrl}/api/clientes`);
  }

  criarCliente(payload: ClientePayload) {
    return this.http.post<ClienteRecord>(`${this.apiUrl}/api/clientes`, payload);
  }

  atualizarCliente(id: string, payload: ClientePayload) {
    return this.http.put<ClienteRecord>(`${this.apiUrl}/api/clientes/${id}`, payload);
  }

  excluirCliente(id: string) {
    return this.http.delete<{
      mensagem: string;
      possuiProcessosVinculados: boolean;
      totalProcessosVinculados: number;
    }>(`${this.apiUrl}/api/clientes/${id}`);
  }

  salvarOrcamentoProcesso(id: string, dados: any) {
    return this.http.put(`${this.apiUrl}/api/processos/${id}/orcamento`, dados);
  }

  converterOrcamentoEmContrato(id: string, dados: any) {
    return this.http.post(`${this.apiUrl}/api/processos/${id}/orcamento/converter-contrato`, dados);
  }

  registrarDocumentoGerado(id: string, dados: any) {
    return this.http.post(`${this.apiUrl}/api/processos/${id}/documentos/registrar`, dados);
  }

  verificarConvite(token: string) {
    return this.http.get<InviteSummary>(`${this.apiUrl}/api/convites/${token}`);
  }

  verificarConvitePorEmail(email: string) {
    return this.http.post<InviteSummary>(`${this.apiUrl}/api/convites/verificar-email`, { email });
  }

  aceitarConvite(payload: InviteAcceptancePayload) {
    return this.http.post<InviteAcceptanceResult>(`${this.apiUrl}/api/convites/aceitar`, payload);
  }
}
