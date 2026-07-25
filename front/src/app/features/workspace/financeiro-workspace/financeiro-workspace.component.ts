import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import {
  AuthService,
  LancamentoFinanceiro,
  LancamentoTipo,
  ResumoFinanceiro
} from '../../../auth.service';
import { ProcessoApiModel } from '../../../shared/processo-ui';

@Component({
  selector: 'app-financeiro-workspace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './financeiro-workspace.component.html',
  styleUrls: ['./financeiro-workspace.component.scss']
})
export class FinanceiroWorkspaceComponent implements OnInit {
  private authService = inject(AuthService);
  private snack = inject(MatSnackBar);

  carregando = false;
  salvando = false;
  lancamentos: LancamentoFinanceiro[] = [];
  resumo: ResumoFinanceiro | null = null;
  processos: ProcessoApiModel[] = [];

  filtroStatus = 'Todos';
  mostrarFormulario = false;

  novoDescricao = '';
  novoTipo: LancamentoTipo = 'HONORARIO';
  novoValor = '';
  novoVencimento = '';
  novoParcelas = 1;
  novoProcessoId = '';
  novoFormaPagamento = '';

  ngOnInit(): void {
    this.carregar();
    this.carregarProcessos();
  }

  carregar(): void {
    this.carregando = true;
    this.authService.listarLancamentos().subscribe({
      next: (lancamentos) => {
        this.lancamentos = lancamentos;
        this.carregando = false;
      },
      error: (error) => {
        this.carregando = false;
        this.snack.open(error?.error?.mensagem || 'Nao foi possivel carregar o financeiro.', 'Fechar', {
          duration: 4000,
          panelClass: ['snack-error']
        });
      }
    });

    this.authService.obterResumoFinanceiro().subscribe({
      next: (resumo) => (this.resumo = resumo),
      error: () => (this.resumo = null)
    });
  }

  private carregarProcessos(): void {
    this.authService.listarProcessos().subscribe({
      next: (processos) => (this.processos = (processos as ProcessoApiModel[]) || []),
      error: () => (this.processos = [])
    });
  }

  get lancamentosFiltrados(): LancamentoFinanceiro[] {
    if (this.filtroStatus === 'Todos') return this.lancamentos;
    return this.lancamentos.filter((lancamento) => lancamento.statusEfetivo === this.filtroStatus);
  }

  alternarFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
  }

  salvarLancamento(): void {
    if (!this.novoDescricao.trim() || !this.novoValor.trim() || !this.novoVencimento) {
      this.snack.open('Preencha descricao, valor e vencimento.', 'OK', {
        duration: 3200,
        panelClass: ['snack-error']
      });
      return;
    }

    this.salvando = true;
    this.authService
      .criarLancamento({
        descricao: this.novoDescricao.trim(),
        tipo: this.novoTipo,
        valor: this.novoValor.trim(),
        vencimento: this.novoVencimento,
        parcelas: Number(this.novoParcelas) || 1,
        processoId: this.novoProcessoId || null,
        formaPagamento: this.novoFormaPagamento.trim() || null
      })
      .subscribe({
        next: (criados) => {
          this.salvando = false;
          this.snack.open(
            criados.length > 1 ? `${criados.length} parcelas lancadas.` : 'Lancamento registrado.',
            'OK',
            { duration: 3200, panelClass: ['snack-success'] }
          );
          this.limparFormulario();
          this.mostrarFormulario = false;
          this.carregar();
        },
        error: (error) => {
          this.salvando = false;
          this.snack.open(error?.error?.mensagem || 'Nao foi possivel salvar o lancamento.', 'Fechar', {
            duration: 4200,
            panelClass: ['snack-error']
          });
        }
      });
  }

  darBaixa(lancamento: LancamentoFinanceiro): void {
    this.authService.atualizarLancamento(lancamento.id, { pago: true }).subscribe({
      next: () => {
        this.snack.open('Pagamento registrado.', 'OK', { duration: 2800, panelClass: ['snack-success'] });
        this.carregar();
      },
      error: (error) =>
        this.snack.open(error?.error?.mensagem || 'Erro ao registrar pagamento.', 'Fechar', {
          duration: 4000,
          panelClass: ['snack-error']
        })
    });
  }

  reabrir(lancamento: LancamentoFinanceiro): void {
    this.authService.atualizarLancamento(lancamento.id, { pago: false }).subscribe({
      next: () => {
        this.snack.open('Pagamento estornado.', 'OK', { duration: 2800 });
        this.carregar();
      },
      error: (error) =>
        this.snack.open(error?.error?.mensagem || 'Erro ao estornar.', 'Fechar', {
          duration: 4000,
          panelClass: ['snack-error']
        })
    });
  }

  excluir(lancamento: LancamentoFinanceiro): void {
    if (!confirm(`Remover o lancamento "${lancamento.descricao}"?`)) return;

    this.authService.excluirLancamento(lancamento.id).subscribe({
      next: () => {
        this.snack.open('Lancamento removido.', 'OK', { duration: 2800 });
        this.carregar();
      },
      error: (error) =>
        this.snack.open(error?.error?.mensagem || 'Erro ao remover.', 'Fechar', {
          duration: 4000,
          panelClass: ['snack-error']
        })
    });
  }

  formatarMoeda(valor?: number | null): string {
    if (typeof valor !== 'number' || Number.isNaN(valor)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  }

  statusClasse(status: string): string {
    switch (status) {
      case 'PAGO':
        return 'is-pago';
      case 'ATRASADO':
        return 'is-atrasado';
      case 'CANCELADO':
        return 'is-cancelado';
      default:
        return 'is-pendente';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'PAGO':
        return 'Pago';
      case 'ATRASADO':
        return 'Atrasado';
      case 'CANCELADO':
        return 'Cancelado';
      default:
        return 'Pendente';
    }
  }

  tipoLabel(tipo: string): string {
    switch (tipo) {
      case 'DESPESA':
        return 'Despesa';
      case 'REEMBOLSO':
        return 'Reembolso';
      default:
        return 'Honorário';
    }
  }

  private limparFormulario(): void {
    this.novoDescricao = '';
    this.novoTipo = 'HONORARIO';
    this.novoValor = '';
    this.novoVencimento = '';
    this.novoParcelas = 1;
    this.novoProcessoId = '';
    this.novoFormaPagamento = '';
  }
}
