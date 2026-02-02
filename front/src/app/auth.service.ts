import { Injectable } from '@angular/core';
import { Auth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http'; // <--- Importamos o carteiro HTTP

@Injectable({ providedIn: 'root' })
export class AuthService {

  // Injetamos o HttpClient no construtor 👇
  constructor(private auth: Auth, private router: Router, private http: HttpClient) { }

  async loginEmail(email: string, pass: string) {
    await signInWithEmailAndPassword(this.auth, email, pass);
    // Não vamos navegar ainda, vamos esperar o backend responder no login.ts
  }

  async loginGoogle() {
    await signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  async getAuthToken(): Promise<string | null> {
    const user = this.auth.currentUser;
    return user ? await user.getIdToken() : null;
  }

  // 👇 NOVO: Manda o Token pro Backend validar
  enviarTokenParaBackend(token: string) {
    // Posta o token na porta 3000
    return this.http.post('http://localhost:3000/api/login-seguro', { token });
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }
  listarEtapas(procId: string) {
    return this.http.get(`http://localhost:3000/api/processos/${procId}/etapas`);
  }

  criarEtapa(procId: string, dados: any) {
    return this.http.post(`http://localhost:3000/api/processos/${procId}/etapas`, dados);
  }

  atualizarStatusEtapa(procId: string, etapaId: string, status: string) {
    return this.http.put(`http://localhost:3000/api/processos/${procId}/etapas/${etapaId}`, { status });
  }
  atualizarProcesso(id: string, dados: any) {
    return this.http.put('http://localhost:3000/api/processos/' + id, dados);
  }
  pegarProcessoPeloId(id: string) {
    return this.http.get(`http://localhost:3000/api/processos/${id}`);
  }
  listarProcessos() {
    return this.http.get('http://localhost:3000/api/processos');
  }
  salvarProcesso(dados: any) {
    return this.http.post('http://localhost:3000/api/processos', dados);
  }
  excluirProcesso(id: string) {
    return this.http.delete('http://localhost:3000/api/processos/' + id);
  }

}
