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

import { AuthService } from '../../../auth.service';
import { ApontamentoHoras, LancamentoFinanceiro, LancamentoTipo, ResumoFinanceiro } from '../../../models/financeiro.model';
import { ProcessoApiModel } from '../../../shared/processo-ui';
import { hojeLocalIso } from '../../../shared/data-local';

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
  apontamentos: ApontamentoHoras[] = [];

  filtroStatus = 'Todos';
  mostrarFormulario = false;
  lancamentoEmBaixa: LancamentoFinanceiro | null = null;
  dataBaixa = hojeLocalIso();
  formaPagamentoBaixa = '';
  salvandoBaixa = false;

  novoDescricao = '';
  novoTipo: LancamentoTipo = 'HONORARIO';
  novoValor: number | null = null;
  novoVencimento = '';
  novoParcelas = 1;
  novoProcessoId = '';
  novoFormaPagamento = '';
  horaProcessoId = '';
  horaDescricao = '';
  horaData = hojeLocalIso();
  horaQuantidade: number | null = null;
  horaValor: number | null = null;
  horaCusto: number | null = null;
  salvandoHoras = false;
  periodo = hojeLocalIso().slice(0, 7);

  ngOnInit(): void {
    this.carregar();
    this.carregarProcessos();
    this.carregarHoras();
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

  carregarHoras(): void {
    this.authService.listarApontamentos().subscribe({
      next: (itens) => (this.apontamentos = itens),
      error: () => this.snack.open('Não foi possível carregar as horas registradas.', 'Fechar', { duration: 4000 })
    });
  }

  get lancamentosPeriodo(): LancamentoFinanceiro[] {
    return this.lancamentos.filter((item) => (item.statusEfetivo === 'PAGO' ? item.pagoEm : item.vencimento)?.slice(0, 7) === this.periodo);
  }

  get horasPeriodo(): ApontamentoHoras[] {
    return this.apontamentos.filter((item) => item.data.slice(0, 7) === this.periodo);
  }

  get recebidoPeriodo(): number {
    return this.lancamentosPeriodo.filter((item) => item.statusEfetivo === 'PAGO' && item.tipo !== 'DESPESA').reduce((total, item) => total + Number(item.valorPago ?? item.valor), 0);
  }

  get despesasPeriodo(): number {
    return this.lancamentosPeriodo.filter((item) => item.statusEfetivo === 'PAGO' && item.tipo === 'DESPESA').reduce((total, item) => total + Number(item.valorPago ?? item.valor), 0);
  }

  get horasTotaisPeriodo(): number {
    return this.horasPeriodo.reduce((total, item) => total + item.minutos, 0) / 60;
  }

  get custoHorasPeriodo(): number {
    return this.horasPeriodo.reduce((total, item) => total + item.minutos / 60 * item.custoHora, 0);
  }

  get valorHorasPeriodo(): number {
    return this.horasPeriodo.reduce((total, item) => total + item.minutos / 60 * item.valorHora, 0);
  }

  get resultadoPeriodo(): number {
    return this.recebidoPeriodo - this.despesasPeriodo - this.custoHorasPeriodo;
  }

  get analiseProcessos(): { id: string; nome: string; cliente: string; horas: number; recebido: number; despesas: number; custoHoras: number; resultado: number }[] {
    const ids = new Set([...this.horasPeriodo.map((item) => item.processoId), ...this.lancamentosPeriodo.map((item) => item.processoId).filter((id): id is string => !!id)]);
    return [...ids].map((id) => {
      const horas = this.horasPeriodo.filter((item) => item.processoId === id);
      const lancamentos = this.lancamentosPeriodo.filter((item) => item.processoId === id && item.statusEfetivo === 'PAGO');
      const recebido = lancamentos.filter((item) => item.tipo !== 'DESPESA').reduce((soma, item) => soma + Number(item.valorPago ?? item.valor), 0);
      const despesas = lancamentos.filter((item) => item.tipo === 'DESPESA').reduce((soma, item) => soma + Number(item.valorPago ?? item.valor), 0);
      const custoHoras = horas.reduce((soma, item) => soma + item.minutos / 60 * item.custoHora, 0);
      const processo = this.processos.find((item) => item.id === id);
      return { id, nome: processo?.titulo || horas[0]?.processoTitulo || lancamentos[0]?.processoTitulo || 'Processo', cliente: processo?.clienteNome || horas[0]?.clienteNome || lancamentos[0]?.clienteNome || '', horas: horas.reduce((soma, item) => soma + item.minutos, 0) / 60, recebido, despesas, custoHoras, resultado: recebido - despesas - custoHoras };
    }).sort((a, b) => b.horas - a.horas).slice(0, 8);
  }

  get serieMensal(): { mes: string; recebido: number; despesas: number; escala: number }[] {
    const [ano, mes] = this.periodo.split('-').map(Number);
    const meses = Array.from({ length: 6 }, (_, indice) => {
      const data = new Date(ano, mes - 1 - (5 - indice), 1);
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
      const pagos = this.lancamentos.filter((item) => item.statusEfetivo === 'PAGO' && item.pagoEm?.slice(0, 7) === chave);
      const recebido = pagos.filter((item) => item.tipo !== 'DESPESA').reduce((total, item) => total + Number(item.valorPago ?? item.valor), 0);
      const despesas = pagos.filter((item) => item.tipo === 'DESPESA').reduce((total, item) => total + Number(item.valorPago ?? item.valor), 0);
      return { mes: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(data), recebido, despesas, escala: 0 };
    });
    const maximo = Math.max(1, ...meses.map((item) => Math.max(item.recebido, item.despesas)));
    return meses.map((item) => ({ ...item, escala: maximo }));
  }

  salvarHoras(): void {
    const quantidade = Number(this.horaQuantidade);
    if (!this.horaProcessoId || !this.horaDescricao.trim() || !this.horaData || !Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 24) {
      this.snack.open('Informe processo, atividade, data e horas (até 24).', 'OK', { duration: 3800 });
      return;
    }
    this.salvandoHoras = true;
    this.authService.criarApontamento({ processoId: this.horaProcessoId, descricao: this.horaDescricao.trim(), data: this.horaData, minutos: Math.round(quantidade * 60), valorHora: Number(this.horaValor) || 0, custoHora: Number(this.horaCusto) || 0 }).subscribe({
      next: () => {
        this.salvandoHoras = false;
        this.horaDescricao = '';
        this.horaQuantidade = null;
        this.snack.open('Horas registradas.', 'OK', { duration: 3000 });
        this.carregarHoras();
      },
      error: (error) => {
        this.salvandoHoras = false;
        this.snack.open(error?.error?.mensagem || 'Não foi possível registrar as horas.', 'Fechar', { duration: 4000 });
      }
    });
  }

  excluirHoras(item: ApontamentoHoras): void {
    if (!confirm(`Remover ${this.formatarHoras(item.minutos / 60)} de ${item.processoTitulo}?`)) return;
    this.authService.excluirApontamento(item.id).subscribe({ next: () => this.carregarHoras(), error: () => this.snack.open('Não foi possível remover as horas.', 'Fechar', { duration: 4000 }) });
  }

  formatarHoras(valor: number): string { return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`; }

  get lancamentosFiltrados(): LancamentoFinanceiro[] {
    if (this.filtroStatus === 'Todos') return this.lancamentos;
    return this.lancamentos.filter((lancamento) => lancamento.statusEfetivo === this.filtroStatus);
  }

  alternarFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
  }

  salvarLancamento(): void {
    if (!this.novoDescricao.trim() || !Number.isFinite(this.novoValor) || Number(this.novoValor) <= 0 || !this.novoVencimento) {
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
        valor: Number(this.novoValor),
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
    this.lancamentoEmBaixa = lancamento;
    this.dataBaixa = hojeLocalIso();
    this.formaPagamentoBaixa = lancamento.formaPagamento || '';
  }

  confirmarBaixa(): void {
    const lancamento = this.lancamentoEmBaixa;
    if (!lancamento || !/^\d{4}-\d{2}-\d{2}$/.test(this.dataBaixa)) return;
    this.salvandoBaixa = true;
    this.authService.atualizarLancamento(lancamento.id, { pago: true, pagoEm: this.dataBaixa, valorPago: lancamento.valor, formaPagamento: this.formaPagamentoBaixa.trim() || null }).subscribe({
      next: () => {
        this.salvandoBaixa = false;
        this.lancamentoEmBaixa = null;
        this.snack.open('Pagamento registrado.', 'OK', { duration: 2800, panelClass: ['snack-success'] });
        this.carregar();
      },
      error: (error) => {
        this.salvandoBaixa = false;
        this.snack.open(error?.error?.mensagem || 'Erro ao registrar pagamento.', 'Fechar', {
          duration: 4000,
          panelClass: ['snack-error']
        });
      }
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
    this.novoValor = null;
    this.novoVencimento = '';
    this.novoParcelas = 1;
    this.novoProcessoId = '';
    this.novoFormaPagamento = '';
  }
}
