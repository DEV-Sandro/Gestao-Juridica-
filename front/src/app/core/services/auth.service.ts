import { Injectable } from '@angular/core';
import { Auth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut, user } from '@angular/fire/auth';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Observa se o usuário está logado
  currentUser$;

  constructor(private auth: Auth, private router: Router) {
    this.currentUser$ = user(this.auth);
  }

  async loginEmail(email: string, pass: string) {
    try {
      await signInWithEmailAndPassword(this.auth, email, pass);
      this.router.navigate(['/dashboard']); // Redireciona ao logar
    } catch (error) {
      throw error;
    }
  }

  async loginGoogle() {
    try {
      await signInWithPopup(this.auth, new GoogleAuthProvider());
      this.router.navigate(['/dashboard']);
    } catch (error) {
      throw error;
    }
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }
}