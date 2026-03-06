import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon'; // Apenas os ícones pro design novo

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatIconModule 
  ],
  templateUrl: './login.html', // (ou .component.html dependendo de como está seu arquivo)
  styleUrls: ['./login.scss']  // (ou .component.scss)
})
export class LoginComponent {
  email = '';
  senha = ''; // 👇 Mudamos para 'senha' para casar com o HTML
  mostrarSenha = false; // Controle do olhinho
  carregando = false; // Controle do botão de Loading

  constructor(private authService: AuthService, private router: Router) {}

  // Função para mostrar/esconder a senha
  toggleSenha() {
    this.mostrarSenha = !this.mostrarSenha;
  }

  async entrar() {
    if (!this.email || !this.senha) {
      alert('Por favor, preencha email e senha.');
      return;
    }

    this.carregando = true;
    try {
      // 👇 Agora ele manda this.senha corretamente pro Firebase
      await this.authService.loginEmail(this.email, this.senha);
      const token = await this.authService.getAuthToken();
      
      if (token) {
        this.authService.enviarTokenParaBackend(token).subscribe({
          next: (resposta: any) => { 
            console.log('Resposta do Servidor:', resposta);
            
            // O DIVISOR DE ÁGUAS
            if (resposta.role === 'ADMIN') {
              this.router.navigate(['/advogado']); // Vai pra mesa do chefe
            } else {
              this.router.navigate(['/cliente']); // Vai pra área do cliente
            }
          },
          error: () => {
            alert('Erro de conexão com o servidor.');
            this.carregando = false;
          }
        });
      }
    } catch (e) {
      alert('Email ou senha inválidos.');
      this.carregando = false;
    }
  }
}