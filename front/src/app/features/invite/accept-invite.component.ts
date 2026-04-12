import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../auth.service';
import { InviteSummary } from '../../models/invite.model';

@Component({
  selector: 'app-accept-invite',
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
    MatSnackBarModule
  ],
  templateUrl: './accept-invite.component.html',
  styleUrls: ['./accept-invite.component.scss']
})
export class AcceptInviteComponent implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snack = inject(MatSnackBar);

  carregando = true;
  salvando = false;
  summary: InviteSummary | null = null;
  token = '';
  emailPendente = '';
  linkConvite = '';

  displayName = '';
  telefone = '';
  cargo = '';
  oab = '';
  password = '';
  confirmPassword = '';

  ngOnInit(): void {
    const temaSalvo = localStorage.getItem('justapro-theme') || 'corporate';
    document.body.setAttribute('data-theme', temaSalvo);

    this.route.queryParamMap.subscribe(async (params) => {
      this.token = params.get('token')?.trim() || '';
      this.emailPendente = params.get('email')?.trim() || '';
      await this.recarregarEstado();
    });
  }

  async validarLinkColado(): Promise<void> {
    const token = this.extrairToken(this.linkConvite);
    if (!token) {
      this.snack.open('Cole o link completo recebido ou o token do convite.', 'Fechar', {
        duration: 3500,
        panelClass: ['snack-error']
      });
      return;
    }

    this.token = token;
    await this.recarregarEstado();
  }

  async aceitarConvite(): Promise<void> {
    if (!this.summary?.canAccept || !this.token) {
      return;
    }

    if (!this.displayName.trim()) {
      this.notificarErro('Informe seu nome para concluir o cadastro.');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.notificarErro('A confirmacao da senha nao confere.');
      return;
    }

    this.salvando = true;

    try {
      await firstValueFrom(
        this.authService.aceitarConvite({
          token: this.token,
          password: this.password,
          displayName: this.displayName.trim(),
          telefone: this.telefone.trim() || null,
          cargo: this.cargo.trim() || null,
          oab: this.oab.trim() || null
        })
      );

      await this.authService.loginEmail(this.summary.email || '', this.password);
      const authToken = await this.authService.getAuthToken();

      if (authToken) {
        const resposta = await firstValueFrom(this.authService.enviarTokenParaBackend(authToken));
        this.snack.open('Conta ativada com sucesso. Bem-vindo ao JustaPro!', 'OK', {
          duration: 3500,
          panelClass: ['snack-success']
        });
        await this.router.navigate([resposta.role === 'CLIENT' ? '/cliente' : '/advogado/dashboard']);
        return;
      }

      await this.router.navigate(['/login']);
    } catch (error: any) {
      this.notificarErro(
        error?.error?.mensagem || error?.message || 'Nao foi possivel concluir o convite.'
      );
    } finally {
      this.salvando = false;
    }
  }

  private async recarregarEstado(): Promise<void> {
    this.carregando = true;

    try {
      if (this.token) {
        this.summary = await firstValueFrom(this.authService.verificarConvite(this.token));
        this.preencherCampos();
        return;
      }

      if (this.emailPendente) {
        this.summary = await firstValueFrom(this.authService.verificarConvitePorEmail(this.emailPendente));
        return;
      }

      this.summary = null;
    } catch (error: any) {
      this.summary = {
        status: error?.status === 410 ? 'EXPIRED' : 'INVALID',
        hasInvite: false
      };
    } finally {
      this.carregando = false;
    }
  }

  private preencherCampos(): void {
    this.displayName = this.summary?.displayName || '';
    this.cargo = this.summary?.cargo || '';
    this.oab = this.summary?.oab || '';
  }

  private extrairToken(valor: string): string {
    const trimmed = valor.trim();
    if (!trimmed) {
      return '';
    }

    if (!trimmed.includes('http')) {
      return trimmed;
    }

    try {
      const url = new URL(trimmed);
      return url.searchParams.get('token')?.trim() || '';
    } catch {
      return '';
    }
  }

  private notificarErro(mensagem: string): void {
    this.snack.open(mensagem, 'Fechar', {
      duration: 4200,
      panelClass: ['snack-error']
    });
  }
}
