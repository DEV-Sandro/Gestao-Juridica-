import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../auth.service';
import { RecuperarSenhaDialogComponent } from './recuperar-senha-dialog.component';
import { JpButtonComponent } from '../shared/ui/jp-button/jp-button.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatSnackBarModule,
    JpButtonComponent
  ],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

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
        // Carrega e aplica o perfil completo (papel/cargo) já com token válido,
        // para o role ficar correto de imediato — sem depender só do /api/me do
        // construtor, que pode correr antes do token estar pronto.
        await this.authService.carregarPerfilDoBackend().catch(() => {});
        await this.router.navigate([resposta.role === 'CLIENT' ? '/cliente' : '/advogado/dashboard']);
      }
    } catch (error: any) {
      if (!this.credencialFirebaseInvalida(error)) {
        this.notificar(this.mensagemFalhaAcesso(error));
        return;
      }

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

  esqueciSenha(): void {
    // O e-mail ja digitado no login entra pre-preenchido, mas o dialog nao depende
    // disso — da para pedir o link direto, sem preencher o formulario antes.
    this.dialog.open(RecuperarSenhaDialogComponent, {
      data: { email: this.email.trim() },
      panelClass: 'jp-dialog-panel',
      backdropClass: 'jp-dialog-backdrop',
      autoFocus: 'first-tabbable'
    });
  }

  async continuarConvite(): Promise<void> {
    const email = this.email.trim();
    await this.router.navigate(['/convite/aceitar'], {
      queryParams: email ? { email } : undefined
    });
  }

  private notificar(mensagem: string): void {
    this.snack.open(mensagem, 'Fechar', {
      duration: 3600,
      panelClass: ['snack-error']
    });
  }

  private credencialFirebaseInvalida(error: unknown): boolean {
    const codigo = String((error as { code?: string } | null)?.code || '');
    return [
      'auth/invalid-credential',
      'auth/user-not-found',
      'auth/wrong-password',
      'auth/invalid-email'
    ].includes(codigo);
  }

  private mensagemFalhaAcesso(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Nao foi possivel conectar ao servidor local. Confirme se o backend esta em execucao.';
      }

      return 'Seu login foi aceito, mas nao foi possivel validar a sessao no servidor. Tente novamente.';
    }

    const codigo = String((error as { code?: string } | null)?.code || '');
    if (codigo === 'auth/too-many-requests') {
      return 'Muitas tentativas seguidas. Aguarde alguns minutos antes de tentar novamente.';
    }

    if (codigo === 'auth/network-request-failed') {
      return 'Falha de conexao ao autenticar. Verifique sua internet e tente novamente.';
    }

    return 'Nao foi possivel concluir o acesso. Tente novamente.';
  }
}
