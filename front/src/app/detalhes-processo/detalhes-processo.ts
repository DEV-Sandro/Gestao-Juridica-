import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
  selector: 'app-detalhes-processo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatCheckboxModule
  ],
  providers: [DatePipe],
  templateUrl: './detalhes-processo.html',
  styleUrls: ['./detalhes-processo.scss']
})
export class DetalhesProcessoComponent implements OnInit {
  processo: any = null;
  id: string = '';

  listaEtapas: any[] = [];
  novaEtapaTitulo = '';
  novaEtapaData = '';

  historico: { data: string; titulo: string; descricao: string; icone: string }[] = [];

  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
    private router: Router,
    private datePipe: DatePipe
  ) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    if (this.id) {
      this.carregarDetalhes();
      this.carregarEtapas();
    }
  }

  mapearProcesso(proc: any) {
    return {
      ...proc,
      cliente: proc.cliente || proc.clienteNome || proc.clienteId || 'Não informado',
      tipo: proc.tipo || proc.titulo || 'Sem tipo',
      descricao: proc.descricao || proc.observacao || '',
      statusVisual: proc.statusCalculado || proc.status || 'Em Andamento'
    };
  }

  carregarDetalhes() {
    this.auth.pegarProcessoPeloId(this.id).subscribe({
      next: (dados: any) => {
        this.processo = this.mapearProcesso(dados);
        this.montarHistorico();
      },
      error: (e: any) => console.error(e)
    });
  }

  carregarEtapas() {
    this.auth.listarEtapas(this.id).subscribe({
      next: (dados: any) => {
        this.listaEtapas = Array.isArray(dados) ? dados : [];
        this.montarHistorico();
      },
      error: (e: any) => console.error(e)
    });
  }

  adicionarEtapa() {
    if (!this.novaEtapaTitulo || !this.novaEtapaData) {
      return alert('Preencha título e data!');
    }

    const dados = {
      titulo: this.novaEtapaTitulo,
      dataLimite: this.novaEtapaData
    };

    this.auth.criarEtapa(this.id, dados).subscribe({
      next: () => {
        this.novaEtapaTitulo = '';
        this.novaEtapaData = '';
        this.carregarEtapas();
      },
      error: (e: any) => console.error(e)
    });
  }

  concluirEtapa(etapa: any) {
    const novoStatus = etapa.status === 'PENDENTE' ? 'CONCLUIDO' : 'PENDENTE';
    this.auth.atualizarStatusEtapa(this.id, etapa.id, novoStatus).subscribe({
      next: () => this.carregarEtapas(),
      error: (e: any) => console.error(e)
    });
  }

  atualizarObservacoes() {
    if (!this.processo) return;

    this.auth.atualizarProcesso(this.id, {
      descricao: this.processo.descricao
    }).subscribe({
      next: () => this.carregarDetalhes(),
      error: (e: any) => console.error(e)
    });
  }

  alterarStatus(status: string) {
    this.auth.atualizarProcesso(this.id, { status }).subscribe({
      next: () => this.carregarDetalhes(),
      error: (e: any) => console.error(e)
    });
  }

  marcarComoConcluido() {
    this.alterarStatus('Concluído');
  }

  deletarProcesso() {
    if (!confirm('Deseja remover este processo?')) return;

    this.auth.excluirProcesso(this.id).subscribe({
      next: () => this.router.navigate(['/advogado']),
      error: (e: any) => console.error(e)
    });
  }

  estaAtrasado(data: string, status: string): boolean {
    if (status === 'CONCLUIDO') return false;
    const hoje = new Date().toISOString().split('T')[0];
    return data < hoje;
  }

  get statusClasse(): string {
    const status = this.processo?.statusVisual || '';
    if (status === 'Atrasado') return 'text-danger';
    if (status === 'Urgente') return 'text-warning';
    if (status === 'Concluído') return 'text-success';
    return 'text-info';
  }

  get prazoFormatado(): string {
    if (!this.processo?.prazo) return '--';
    return this.datePipe.transform(this.processo.prazo, 'dd/MM/yyyy') || '--';
  }

  montarHistorico() {
    if (!this.processo) return;

    const eventos: { data: string; titulo: string; descricao: string; icone: string }[] = [];

    if (this.processo.criadoEm) {
      eventos.push({
        data: this.processo.criadoEm,
        titulo: 'Processo criado',
        descricao: `Cadastro inicial do processo ${this.processo.tipo}.`,
        icone: 'add_circle'
      });
    }

    if (this.processo.atualizadoEm && this.processo.atualizadoEm !== this.processo.criadoEm) {
      eventos.push({
        data: this.processo.atualizadoEm,
        titulo: 'Processo atualizado',
        descricao: 'Dados principais do processo foram alterados.',
        icone: 'edit'
      });
    }

    if (this.processo.statusVisual) {
      eventos.push({
        data: this.processo.atualizadoEm || this.processo.criadoEm || new Date().toISOString(),
        titulo: `Status atual: ${this.processo.statusVisual}`,
        descricao: 'Último status conhecido do processo.',
        icone: this.processo.statusVisual === 'Atrasado' ? 'error' : this.processo.statusVisual === 'Urgente' ? 'notification_important' : 'schedule'
      });
    }

    if (this.processo.prazo) {
      eventos.push({
        data: this.processo.prazo,
        titulo: 'Prazo definido',
        descricao: `Prazo registrado para ${this.prazoFormatado}.`,
        icone: 'event'
      });
    }

    this.listaEtapas.forEach((etapa: any) => {
      eventos.push({
        data: etapa.dataLimite || etapa.criadoEm || new Date().toISOString(),
        titulo: etapa.status === 'CONCLUIDO' ? 'Etapa concluída' : 'Etapa criada',
        descricao: etapa.titulo,
        icone: etapa.status === 'CONCLUIDO' ? 'check_circle' : 'flag'
      });
    });

    this.historico = eventos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }

  voltar() {
    this.router.navigate(['/advogado']);
  }
}