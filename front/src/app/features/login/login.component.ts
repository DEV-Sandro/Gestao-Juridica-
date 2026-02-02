import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: false  // <--- ADICIONE ISSO AQUI PARA CORRIGIR O ERRO
})
export class LoginComponent {
  email = '';
  password = '';
  erro = '';
  carregando = false;

  constructor(private authService: AuthService, private router: Router) {}

  async entrar() {
    this.carregando = true;
    this.erro = '';
    
    try {
      await this.authService.loginEmail(this.email, this.password);
      // Se der certo, o redirecionamento acontece no auth.service ou aqui:
      this.router.navigate(['/dashboard']);
    } catch (e: any) {
      this.erro = "Email ou senha incorretos.";
      console.error(e);
    } finally {
      this.carregando = false;
    }
  }

  async entrarGoogle() {
    try {
      await this.authService.loginGoogle();
      this.router.navigate(['/dashboard']);
    } catch (e) {
      this.erro = "Erro ao entrar com Google.";
    }
  }
}