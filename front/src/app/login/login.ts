import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatCheckboxModule,
    MatSnackBarModule
  ],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private snack = inject(MatSnackBar);

  email = '';
  senha = '';
  mostrarSenha = false;
  carregando = false;

  ngOnInit() {
    const temaSalvo = localStorage.getItem('justapro-theme') || 'corporate';
    document.body.setAttribute('data-theme', temaSalvo);
    document.documentElement.style.colorScheme = temaSalvo === 'light' ? 'light' : 'dark';
  }

  async acessar() {
    if (!this.email || !this.senha) {
      this.notificar('Preencha e-mail e senha para continuar.');
      return;
    }

    this.carregando = true;

    try {
      await this.authService.loginEmail(this.email, this.senha);
      const token = await this.authService.getAuthToken();

      if (token) {
        const resposta = await firstValueFrom(this.authService.enviarTokenParaBackend(token));
        await this.router.navigate([resposta.role === 'CLIENT' ? '/cliente' : '/advogado/dashboard']);
      }
    } catch (error: any) {
      const convite = await firstValueFrom(this.authService.verificarConvitePorEmail(this.email.trim())).catch(
        () => null
      );

      if (convite?.status === 'PENDING') {
        this.notificar('Este e-mail possui convite pendente. Continue a ativacao da conta.');
        await this.router.navigate(['/convite/aceitar'], {
          queryParams: { email: this.email.trim() }
        });
      } else {
        this.notificar('E-mail ou senha invalidos.');
      }
    } finally {
      this.carregando = false;
    }
  }

  private notificar(mensagem: string): void {
    this.snack.open(mensagem, 'Fechar', {
      duration: 3600,
      panelClass: ['snack-error']
    });
  }
}
