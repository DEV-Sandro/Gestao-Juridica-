import { Injectable, inject } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from '@angular/fire/auth';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

import { environment } from '../environments/environment';
import { AppUser, ConviteMembroPayload, UserRole } from './models/app-user.model';
import { ClientePayload, ClienteRecord } from './models/client.model';
import {
  InviteAcceptancePayload,
  InviteAcceptanceResult,
  InviteCreateResponse,
  InviteSummary
} from './models/invite.model';

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

  removerMembro(uid: string) {
    return this.http.delete(`${this.apiUrl}/api/equipe/${uid}`);
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
