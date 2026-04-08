import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatFormFieldModule,
    MatInputModule, MatIconModule, MatButtonModule, MatCheckboxModule
  ],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent implements OnInit {
  email = '';
  senha = ''; 
  mostrarSenha = false; 
  carregando = false; 

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    // Garante que o tema salva será carregado na tela de login
    const temaSalvo = localStorage.getItem('justapro-theme') || 'corporate';
    document.body.setAttribute('data-theme', temaSalvo);
  }

  async acessar() { 
    if (!this.email || !this.senha) {
      alert('Por favor, preencha email e senha.');
      return;
    }

    this.carregando = true;
    try {
      await this.authService.loginEmail(this.email, this.senha);
      const token = await this.authService.getAuthToken();
      
      if (token) {
        this.authService.enviarTokenParaBackend(token).subscribe({
          next: (resposta: any) => { 
            if (resposta.role === 'ADMIN') this.router.navigate(['/advogado']); 
            else this.router.navigate(['/cliente']); 
          },
          error: () => { alert('Erro de conexão com o servidor.'); this.carregando = false; }
        });
      }
      
    } catch (e) {
      alert('Email ou senha inválidos.');
      this.carregando = false;
    }
  }
}