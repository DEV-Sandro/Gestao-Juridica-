import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../../auth.service';
import { AppUser } from '../../../models/app-user.model';
import { AvatarUploadService } from '../services/avatar-upload.service';

interface UploadFeedback {
  tone: 'success' | 'error' | 'info';
  text: string;
}

@Component({
  selector: 'app-meu-perfil',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatSnackBarModule
  ],
  templateUrl: './meu-perfil.component.html',
  styleUrls: ['./meu-perfil.component.scss']
})
export class MeuPerfilComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private avatarUpload = inject(AvatarUploadService);
  private snack = inject(MatSnackBar);

  user: AppUser | null = null;
  uploadando = false;
  preparandoImagem = false;
  removendoFoto = false;
  salvando = false;

  arquivoSelecionado: File | null = null;
  previewUrl: string | null = null;
  uploadProgress = 0;
  arquivoSelecionadoLabel = '';

  displayName = '';
  telefone = '';
  cargo = '';
  oab = '';

  uploadFeedback: UploadFeedback | null = null;

  private sub?: Subscription;

  ngOnInit(): void {
    const temaSalvo = localStorage.getItem('justapro-theme') || 'corporate';
    document.body.setAttribute('data-theme', temaSalvo);

    this.sub = this.authService.currentUser$.subscribe((user) => {
      this.user = user;
      if (user) {
        this.displayName = user.displayName ?? '';
        this.telefone = user.telefone ?? '';
        this.cargo = user.cargo ?? '';
        this.oab = user.oab ?? '';
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.descartarPreview();
  }

  async selecionarArquivoPremium(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    const erro = this.avatarUpload.validar(file);
    if (erro) {
      this.uploadFeedback = { tone: 'error', text: erro };
      this.snack.open(erro, 'OK', { duration: 4000, panelClass: ['snack-error'] });
      return;
    }

    this.preparandoImagem = true;
    this.uploadFeedback = {
      tone: 'info',
      text: 'Preparando imagem e ajustando enquadramento para o avatar...'
    };

    try {
      const arquivoPreparado = await this.avatarUpload.prepararImagemParaAvatar(file);
      this.descartarPreview();
      this.arquivoSelecionado = arquivoPreparado;
      this.arquivoSelecionadoLabel = `${arquivoPreparado.name} - ${(arquivoPreparado.size / 1024 / 1024).toFixed(2)}MB`;
      this.previewUrl = this.avatarUpload.gerarPreview(arquivoPreparado);
      this.uploadFeedback = {
        tone: 'info',
        text: 'Pre-visualizacao pronta. Confirme para salvar a nova foto no seu perfil.'
      };
    } catch (error: unknown) {
      const mensagem = this.extrairMensagemErro(
        error,
        'Nao foi possivel processar esta imagem. Tente outro arquivo.'
      );
      this.uploadFeedback = { tone: 'error', text: mensagem };
      this.snack.open(mensagem, 'Fechar', {
        duration: 4200,
        panelClass: ['snack-error']
      });
    } finally {
      this.preparandoImagem = false;
    }
  }

  cancelarPreview(): void {
    this.descartarPreview();
    this.arquivoSelecionado = null;
    this.arquivoSelecionadoLabel = '';
    this.uploadFeedback = null;
  }

  async confirmarUpload(): Promise<void> {
    if (!this.arquivoSelecionado || !this.user) {
      return;
    }

    this.uploadando = true;
    this.uploadProgress = 0;
    this.uploadFeedback = {
      tone: 'info',
      text: 'Enviando imagem com seguranca e sincronizando com o seu perfil...'
    };

    this.avatarUpload.uploadComProgresso(this.user.uid, this.arquivoSelecionado).subscribe({
      next: async (progress) => {
        this.uploadProgress = progress.progress;

        if (progress.state === 'success' && progress.profile) {
          try {
            await this.authService.aplicarPerfilRecebido(progress.profile);
            this.cancelarPreview();
            this.uploadFeedback = {
              tone: 'success',
              text: 'Foto de perfil atualizada com sucesso.'
            };
            this.snack.open('Foto de perfil atualizada com sucesso!', 'OK', {
              duration: 3000,
              panelClass: ['snack-success']
            });
          } catch (error: unknown) {
            const mensagem = this.extrairMensagemErro(error, 'Erro ao salvar a foto no perfil.');
            this.uploadFeedback = { tone: 'error', text: mensagem };
            this.snack.open(mensagem, 'Fechar', {
              duration: 4000,
              panelClass: ['snack-error']
            });
          } finally {
            this.uploadando = false;
          }
          return;
        }

        if (progress.state === 'error') {
          const mensagem = progress.error || 'Falha no upload da imagem.';
          this.uploadFeedback = { tone: 'error', text: mensagem };
          this.snack.open(mensagem, 'Fechar', {
            duration: 4000,
            panelClass: ['snack-error']
          });
          this.uploadando = false;
        }
      },
      error: (error: unknown) => {
        const mensagem = this.extrairMensagemErro(error, 'Falha no upload da imagem.');
        this.uploadFeedback = { tone: 'error', text: mensagem };
        this.snack.open(mensagem, 'Fechar', {
          duration: 4000,
          panelClass: ['snack-error']
        });
        this.uploadando = false;
      }
    });
  }

  async removerFoto(): Promise<void> {
    if (!this.user || !this.user.photoURL || this.removendoFoto || this.uploadando) {
      return;
    }

    this.removendoFoto = true;
    this.uploadFeedback = {
      tone: 'info',
      text: 'Removendo foto atual e atualizando seu perfil...'
    };

    try {
      const atualizado = await firstValueFrom(this.avatarUpload.removerFotoAtual());
      await this.authService.aplicarPerfilRecebido(atualizado);
      this.cancelarPreview();
      this.uploadFeedback = {
        tone: 'success',
        text: 'Foto removida. O avatar com iniciais ja esta ativo no sistema.'
      };
      this.snack.open('Foto removida com sucesso.', 'OK', {
        duration: 3000,
        panelClass: ['snack-success']
      });
    } catch (error: unknown) {
      const mensagem = this.extrairMensagemErro(error, 'Nao foi possivel remover a foto.');
      this.uploadFeedback = { tone: 'error', text: mensagem };
      this.snack.open(mensagem, 'Fechar', {
        duration: 4000,
        panelClass: ['snack-error']
      });
    } finally {
      this.removendoFoto = false;
    }
  }

  async salvar(): Promise<void> {
    if (!this.displayName.trim()) {
      this.snack.open('O nome nao pode ficar vazio.', 'OK', { duration: 3000 });
      return;
    }

    this.salvando = true;

    try {
      await this.authService.atualizarMeuPerfil({
        displayName: this.displayName.trim(),
        telefone: this.telefone.trim() || null,
        cargo: this.cargo.trim() || null,
        oab: this.oab.trim() || null
      });

      this.snack.open('Perfil atualizado com sucesso!', 'OK', {
        duration: 3000,
        panelClass: ['snack-success']
      });
    } catch (error: unknown) {
      const mensagem = this.extrairMensagemErro(error, 'Erro ao salvar o perfil.');
      this.snack.open(mensagem, 'Fechar', {
        duration: 4000,
        panelClass: ['snack-error']
      });
    } finally {
      this.salvando = false;
    }
  }

  iniciais(nome?: string | null): string {
    if (!nome) {
      return '?';
    }

    return nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() || '')
      .join('');
  }

  private extrairMensagemErro(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error?.mensagem === 'string' && error.error.mensagem.trim()) {
        return error.error.mensagem;
      }

      if (typeof error.error?.erro === 'string' && error.error.erro.trim()) {
        return error.error.erro;
      }

      if (error.status === 413) {
        return 'A imagem excede o limite permitido. Use um arquivo de ate 5MB.';
      }

      if (error.status === 415) {
        return 'Formato invalido. Use JPG, PNG ou WEBP.';
      }

      if (error.status >= 500) {
        return 'O servidor esta indisponivel no momento. Tente novamente em instantes.';
      }
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }

  private descartarPreview(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }
}
