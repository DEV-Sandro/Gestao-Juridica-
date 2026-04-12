import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../auth.service';
import { AppUser, UserRole } from '../../../models/app-user.model';
import { ConvidarMembroDialogComponent } from './convidar-membro-dialog.component';

@Component({
  selector: 'app-equipe',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './equipe.component.html',
  styleUrls: ['./equipe.component.scss']
})
export class EquipeComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  meuUid: string | null = null;
  membros: AppUser[] = [];
  carregando = false;

  private sub?: Subscription;

  ngOnInit(): void {
    const temaSalvo = localStorage.getItem('justapro-theme') || 'corporate';
    document.body.setAttribute('data-theme', temaSalvo);

    this.sub = this.authService.currentUser$.subscribe((u) => {
      this.meuUid = u?.uid ?? null;
    });

    this.carregar();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  carregar() {
    this.carregando = true;
    this.authService.listarEquipe().subscribe({
      next: (lista) => {
        this.membros = lista || [];
        this.carregando = false;
      },
      error: (err) => {
        this.carregando = false;
        this.snack.open(
          err?.error?.mensagem || 'Erro ao carregar equipe',
          'Fechar',
          { duration: 4000 }
        );
      }
    });
  }

  abrirConvite() {
    const ref = this.dialog.open(ConvidarMembroDialogComponent, {
      panelClass: 'jp-dialog-panel',
      backdropClass: 'jp-dialog-backdrop'
    });
    ref.afterClosed().subscribe((payload) => {
      if (!payload) return;
      this.authService.convidarMembro(payload).subscribe({
        next: async (resposta) => {
          try {
            await navigator.clipboard.writeText(resposta.acceptUrl);
            this.snack.open('Convite criado e link copiado para a area de transferencia.', 'OK', {
              duration: 4200,
              panelClass: ['snack-success']
            });
          } catch {
            this.snack.open('Convite criado com sucesso. Compartilhe o link gerado com o membro.', 'OK', {
              duration: 4200,
              panelClass: ['snack-success']
            });
          }
          this.carregar();
        },
        error: (err) =>
          this.snack.open(
            err?.error?.mensagem || 'Falha ao enviar convite',
            'Fechar',
            { duration: 4000 }
          )
      });
    });
  }

  alterarRole(membro: AppUser, novoRole: UserRole) {
    if (membro.role === novoRole) return;
    this.authService.atualizarRoleMembro(membro.uid, novoRole).subscribe({
      next: (atualizado) => {
        membro.role = atualizado.role;
        this.snack.open('Função atualizada', 'OK', { duration: 2500 });
      },
      error: (err) =>
        this.snack.open(
          err?.error?.mensagem || 'Erro ao alterar função',
          'Fechar',
          { duration: 4000 }
        )
    });
  }

  remover(membro: AppUser) {
    if (membro.uid === this.meuUid) {
      this.snack.open('Você não pode remover seu próprio usuário', 'OK', { duration: 3500 });
      return;
    }
    if (!confirm(`Remover ${membro.displayName || membro.email} da equipe?`)) return;
    this.authService.removerMembro(membro.uid).subscribe({
      next: () => {
        this.membros = this.membros.filter((m) => m.uid !== membro.uid);
        this.snack.open('Membro removido', 'OK', { duration: 2500 });
      },
      error: (err) =>
        this.snack.open(
          err?.error?.mensagem || 'Erro ao remover',
          'Fechar',
          { duration: 4000 }
        )
    });
  }

  iniciais(nome?: string | null): string {
    if (!nome) return '?';
    return nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  }
}
