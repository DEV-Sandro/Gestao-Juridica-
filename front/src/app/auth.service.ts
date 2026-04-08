import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from '@angular/fire/auth';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://localhost:3000';


  constructor(
    private auth: Auth,
    private router: Router,
    private http: HttpClient
  ) {}

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
    return this.http.post(`${this.apiUrl}/api/login-seguro`, { token });
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }

  listarEtapas(procId: string) {
    return this.http.get(`${this.apiUrl}/api/processos/${procId}/etapas`);
  }

  pegarTabelasOAB() {
    return this.http.get(`${this.apiUrl}/api/honorarios`);
  }

  criarEtapa(procId: string, dados: any) {
    return this.http.post(`${this.apiUrl}/api/processos/${procId}/etapas`, dados);
  }

  atualizarStatusEtapa(procId: string, etapaId: string, status: string) {
    return this.http.put(
      `${this.apiUrl}/api/processos/${procId}/etapas/${etapaId}`,
      { status }
    );
  }

  atualizarProcesso(id: string, dados: any) {
    return this.http.put(`${this.apiUrl}/api/processos/${id}`, dados);
  }

  pegarProcessoPeloId(id: string) {
    return this.http.get(`${this.apiUrl}/api/processos/${id}`);
  }

  listarProcessos() {
    return this.http.get(`${this.apiUrl}/api/processos`);
  }

  salvarProcesso(dados: any) {
    return this.http.post(`${this.apiUrl}/api/processos`, dados);
  }

  excluirProcesso(id: string) {
    return this.http.delete(`${this.apiUrl}/api/processos/${id}`);
  }
}