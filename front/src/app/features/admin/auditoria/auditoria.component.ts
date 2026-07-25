import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AuditoriaRegistro, AuthService } from '../../../auth.service';

const ENTIDADES_CONHECIDAS = [
  { value: 'PROCESSO', label: 'Processo' },
  { value: 'CLIENTE', label: 'Cliente' },
  { value: 'CONFIGURACAO', label: 'Configuração' },
  { value: 'USUARIO', label: 'Usuário' }
];

@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule
  ],
  templateUrl: './auditoria.component.html',
  styleUrls: ['./auditoria.component.scss']
})
export class AuditoriaComponent implements OnInit {
  private authService = inject(AuthService);
  private snack = inject(MatSnackBar);

  readonly entidades = ENTIDADES_CONHECIDAS;

  registros: AuditoriaRegistro[] = [];
  carregando = false;

  filtroEntidade = 'Todas';
  filtroTexto = '';
  filtroDe = '';
  filtroAte = '';

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.authService
      .listarAuditoria({
        entidade: this.filtroEntidade !== 'Todas' ? this.filtroEntidade : undefined,
        de: this.filtroDe || undefined,
        ate: this.filtroAte || undefined,
        limite: 200
      })
      .subscribe({
        next: (registros) => {
          this.registros = registros;
          this.carregando = false;
        },
        error: (err) => {
          this.carregando = false;
          this.snack.open(err?.error?.mensagem || 'Erro ao carregar auditoria.', 'Fechar', {
            duration: 4000,
            panelClass: ['snack-error']
          });
        }
      });
  }

  get registrosFiltrados(): AuditoriaRegistro[] {
    const termo = this.filtroTexto.trim().toLowerCase();
    if (!termo) return this.registros;

    return this.registros.filter((registro) => {
      const alvo = [registro.usuarioEmail, registro.usuarioNome, registro.acao]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return alvo.includes(termo);
    });
  }

  limparFiltros(): void {
    this.filtroEntidade = 'Todas';
    this.filtroTexto = '';
    this.filtroDe = '';
    this.filtroAte = '';
    this.carregar();
  }

  resumoDetalhes(detalhes: Record<string, unknown>): string {
    if (!detalhes || Object.keys(detalhes).length === 0) return '—';
    try {
      return JSON.stringify(detalhes).slice(0, 160);
    } catch {
      return '—';
    }
  }
}
