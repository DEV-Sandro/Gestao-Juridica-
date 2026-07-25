import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../auth.service';

@Component({
  selector: 'app-recuperar-senha-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './recuperar-senha-dialog.component.html',
  styleUrls: ['./recuperar-senha-dialog.component.scss']
})
export class RecuperarSenhaDialogComponent {
  private ref = inject(MatDialogRef<RecuperarSenhaDialogComponent>);
  private authService = inject(AuthService);
  private dados = inject<{ email?: string }>(MAT_DIALOG_DATA, { optional: true });

  email = this.dados?.email || '';
  enviando = false;
  enviado = false;
  erro: string | null = null;

  async enviar(): Promise<void> {
    const email = this.email.trim();
    this.erro = null;

    if (!email) {
      this.erro = 'Informe o e-mail cadastrado.';
      return;
    }

    this.enviando = true;

    try {
      await this.authService.enviarResetSenha(email);
    } catch (error: any) {
      const codigo = String(error?.code || '');

      // Só erros operacionais reais viram mensagem. "Usuário não encontrado" cai
      // no fluxo de sucesso de propósito: revelar isso permitiria descobrir quais
      // e-mails têm conta no sistema.
      if (codigo === 'auth/invalid-email') {
        this.enviando = false;
        this.erro = 'E-mail inválido. Confira o endereço digitado.';
        return;
      }

      if (codigo === 'auth/too-many-requests') {
        this.enviando = false;
        this.erro = 'Muitas tentativas seguidas. Aguarde alguns minutos.';
        return;
      }

      if (codigo === 'auth/network-request-failed') {
        this.enviando = false;
        this.erro = 'Falha de conexão. Verifique sua internet.';
        return;
      }
    }

    this.enviando = false;
    this.enviado = true;
  }

  fechar(): void {
    this.ref.close(this.enviado);
  }
}
