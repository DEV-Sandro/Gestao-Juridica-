import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Subscription, interval } from 'rxjs';

import {
  ApontamentoTempo,
  AuthService,
  IndicadorRentabilidade,
  LancamentoFinanceiro,
  RentabilidadeItem,
  RentabilidadeResumo
} from '../../../auth.service';

@Component({
  selector: 'app-rentabilidade-workspace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './rentabilidade-workspace.component.html',
  styleUrls: ['./rentabilidade-workspace.component.scss']
})
export class RentabilidadeWorkspaceComponent implements OnInit, OnDestroy {
  dados: RentabilidadeResumo | null = null;
  carregando = true;
  erro = '';
  salvandoTempo = false;
  mostrarAjusteTempo = false;

  processoSelecionadoId = '';
  horasManuais: number | null = null;
  dataManual = new Date().toISOString().slice(0, 10);
  descricaoManual = '';
  processoPorLancamento: Record<string, string> = {};
  salvandoClassificacaoId: string | null = null;
  private atualizacaoAutomatica?: Subscription;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.carregar();
    // Os totais de tempo são materializados pelo backend; esta atualização
    // discreta traz pagamentos e compromissos novos sem exigir recarga manual.
    this.atualizacaoAutomatica = interval(60_000).subscribe(() => this.carregar(true));
  }

  ngOnDestroy(): void {
    this.atualizacaoAutomatica?.unsubscribe();
  }

  carregar(silencioso = false): void {
    if (!silencioso) {
      this.carregando = true;
      this.erro = '';
    }
    this.authService.obterRentabilidade().subscribe({
      next: (dados) => {
        this.dados = dados;
        this.carregando = false;
      },
      error: (error) => {
        if (!silencioso) {
          this.erro = error?.error?.mensagem || 'Não foi possível carregar a rentabilidade agora.';
        }
        this.carregando = false;
      }
    });
  }

  temLancamentosParaClassificar(resumo: RentabilidadeResumo): boolean {
    // Mantém a tela compatível durante a atualização gradual do backend.
    return Array.isArray(resumo.lancamentosParaClassificar) && resumo.lancamentosParaClassificar.length > 0;
  }

  salvarTempoManual(): void {
    const horas = Number(this.horasManuais);
    const minutos = Math.round(horas * 60);
    if (!this.processoSelecionadoId || !Number.isFinite(horas) || minutos < 1 || minutos > 24 * 60) {
      this.erro = 'Escolha o processo e informe entre 1 minuto e 24 horas.';
      return;
    }

    this.salvandoTempo = true;
    this.erro = '';
    this.authService
      .adicionarTempoManual(this.processoSelecionadoId, {
        minutos,
        data: this.dataManual,
        descricao: this.descricaoManual.trim() || undefined
      })
      .subscribe({
        next: () => {
          this.horasManuais = null;
          this.descricaoManual = '';
          this.mostrarAjusteTempo = false;
          this.salvandoTempo = false;
          this.carregar();
        },
        error: (error) => {
          this.erro = error?.error?.mensagem || 'Não foi possível registrar o ajuste de tempo.';
          this.salvandoTempo = false;
        }
      });
  }

  removerApontamento(apontamento: ApontamentoTempo): void {
    if (!globalThis.confirm(`Remover ${this.formatarHoras(apontamento.minutos / 60)} de ${apontamento.processoTitulo}?`)) {
      return;
    }

    this.authService.excluirApontamentoTempo(apontamento.id).subscribe({
      next: () => this.carregar(),
      error: (error) => (this.erro = error?.error?.mensagem || 'Não foi possível remover o apontamento.')
    });
  }

  vincularLancamento(lancamento: LancamentoFinanceiro): void {
    const processoId = this.processoPorLancamento[lancamento.id];
    if (!processoId) {
      this.erro = 'Escolha o processo para vincular este lançamento.';
      return;
    }

    this.salvarClassificacao(lancamento, { processoId });
  }

  manterLancamentoNoGeral(lancamento: LancamentoFinanceiro): void {
    this.salvarClassificacao(lancamento, { classificacaoRentabilidade: 'GERAL' });
  }

  private salvarClassificacao(lancamento: LancamentoFinanceiro, payload: Record<string, string>): void {
    this.salvandoClassificacaoId = lancamento.id;
    this.erro = '';

    this.authService.atualizarLancamento(lancamento.id, payload).subscribe({
      next: () => {
        delete this.processoPorLancamento[lancamento.id];
        this.salvandoClassificacaoId = null;
        this.carregar();
      },
      error: (error) => {
        this.erro = error?.error?.mensagem || 'Não foi possível salvar a classificação do lançamento.';
        this.salvandoClassificacaoId = null;
      }
    });
  }

  tipoLancamentoLabel(lancamento: LancamentoFinanceiro): string {
    if (lancamento.tipo === 'DESPESA') return 'Despesa paga';
    if (lancamento.tipo === 'REEMBOLSO') return 'Reembolso recebido';
    return 'Honorário recebido';
  }

  formatarMoeda(valor?: number | null): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
  }

  formatarHoras(horas?: number | null): string {
    return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(horas || 0)} h`;
  }

  formatarData(data: string): string {
    if (!data) return '--';
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${data}T12:00:00Z`));
  }

  indicadorLabel(indicador?: IndicadorRentabilidade): string {
    const labels: Record<IndicadorRentabilidade, string> = {
      ALTA: 'Alta',
      MEDIA: 'Média',
      BAIXA: 'Baixa',
      SEM_HORAS: 'Sem horas'
    };
    return labels[indicador || 'SEM_HORAS'];
  }

  indicadorClasse(indicador?: IndicadorRentabilidade): string {
    return `indicador-${(indicador || 'SEM_HORAS').toLowerCase()}`;
  }

  nomeItem(item: RentabilidadeItem | null | undefined): string {
    return item?.titulo || item?.clienteNome || '--';
  }

  formatarRentabilidade(item: RentabilidadeItem | null | undefined): string {
    return item?.rentabilidade === null || !item ? '--' : `${this.formatarMoeda(item.rentabilidade)}/h`;
  }

  trackById(_: number, item: { id: string | null }): string | null {
    return item.id;
  }
}
