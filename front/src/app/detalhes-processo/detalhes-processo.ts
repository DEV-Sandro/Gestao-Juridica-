import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../auth.service';
import { ClienteRecord } from '../models/client.model';
import {
  HistoricoRegistroApi,
  OrcamentoStatus,
  ProcessoOrcamento,
  ProcessoApiModel,
  ProcessoStatusVisual,
  ProcessoViewModel,
  TimelineItem,
  categoriaCompromissoLabel,
  formatarMoeda,
  formatarResumoPrazo,
  mapearHistoricoParaTimeline,
  mapearProcessoParaTela,
  normalizarOrcamentoStatus,
  obterMetaStatus
} from '../shared/processo-ui';
import {
  DocumentGeneratorService,
  DocumentTemplateDefinition,
  LEGAL_TEMPLATES
} from '../features/workspace/documentos-workspace/document-generator.service';

interface EtapaViewModel {
  id: string;
  titulo: string;
  dataLimite: string;
  status: 'PENDENTE' | 'CONCLUIDO';
  tipo: 'PRAZO' | 'AUDIENCIA' | 'EVENTO' | 'DOCUMENTO';
  local: string | null;
  observacao: string | null;
  urgenteManual: boolean;
  atualizadoEm?: string | null;
}

@Component({
  selector: 'app-detalhes-processo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSnackBarModule
  ],
  providers: [DatePipe],
  templateUrl: './detalhes-processo.html',
  styleUrls: ['./detalhes-processo.scss']
})
export class DetalhesProcessoComponent implements OnInit {
  @ViewChild('etapaTituloInput') etapaTituloInput?: ElementRef<HTMLInputElement>;

  readonly historicoResumoLimite = 5;
  readonly orcamentoStatusOptions: Array<{ value: OrcamentoStatus; label: string }> = [
    { value: 'RASCUNHO', label: 'Rascunho' },
    { value: 'ENVIADO_CLIENTE', label: 'Enviado ao cliente' },
    { value: 'AGUARDANDO_RESPOSTA_CLIENTE', label: 'Aguardando resposta do cliente' },
    { value: 'ACEITO', label: 'Aceito' },
    { value: 'RECUSADO', label: 'Recusado' },
    { value: 'CONVERTIDO_CONTRATO', label: 'Convertido em contrato' }
  ];

  processo: ProcessoViewModel | null = null;
  id = '';

  listaEtapas: EtapaViewModel[] = [];
  historico: TimelineItem[] = [];
  timelineExpandida = false;
  clienteDetalhe: ClienteRecord | null = null;
  readonly templatesDocumentos: DocumentTemplateDefinition[] = LEGAL_TEMPLATES;
  readonly contratoTemplate: DocumentTemplateDefinition | undefined = LEGAL_TEMPLATES.find(
    (template) => template.id === 'honorarios'
  );

  novaEtapaTitulo = '';
  novaEtapaData = '';
  novoTipoEtapa: 'PRAZO' | 'AUDIENCIA' | 'EVENTO' | 'DOCUMENTO' = 'PRAZO';
  novoLocalEtapa = '';
  novaObservacaoEtapa = '';
  novoStatusEtapa: 'PENDENTE' | 'CONCLUIDO' = 'PENDENTE';
  novaEtapaUrgente = false;
  etapaEmEdicaoId: string | null = null;
  etapaDrawerAberto = false;
  novaObservacao = '';
  orcamentoForm: {
    valor: string;
    descricaoServico: string;
    observacoes: string;
    status: OrcamentoStatus;
    estadoOab: string;
  } = {
    valor: '',
    descricaoServico: '',
    observacoes: '',
    status: 'RASCUNHO',
    estadoOab: ''
  };
  tabelasOab: Record<string, string> = {};
  erroTabelasOab = '';

  carregando = true;
  carregandoHonorarios = false;
  salvandoObservacoes = false;
  salvandoOrcamento = false;
  salvandoEtapa = false;
  gerandoDocumento = false;
  convertendoOrcamento = false;
  atualizandoPrioridade = false;
  processandoEtapaId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
    private router: Router,
    private datePipe: DatePipe,
    private snack: MatSnackBar,
    private documentGenerator: DocumentGeneratorService
  ) {}

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    if (!this.id) {
      return;
    }

    this.carregarTabelasOab();
    this.recarregarTudo();
  }

  get prazoFormatado(): string {
    if (!this.processo?.prazo) return '--';
    return this.datePipe.transform(this.processo.prazo, 'dd/MM/yyyy') || '--';
  }

  get processoConcluido(): boolean {
    return this.processo?.statusDinamico === 'Concluído';
  }

  get categoriaCompromissoLabel(): string {
    if (!this.processo) return '--';
    return categoriaCompromissoLabel(this.processo.categoriaCompromisso);
  }

  get resumoPrazo(): string {
    return this.processo ? formatarResumoPrazo(this.processo) : '--';
  }

  get editandoEtapa(): boolean {
    return !!this.etapaEmEdicaoId;
  }

  get orcamentoAtual(): ProcessoOrcamento | null {
    return this.processo?.orcamento || null;
  }

  get oabEstadosDisponiveis(): string[] {
    return Object.keys(this.tabelasOab).sort((primeiro, segundo) =>
      primeiro.localeCompare(segundo, 'pt-BR')
    );
  }

  get linkTabelaOabSelecionada(): string | null {
    const estado = (this.orcamentoForm.estadoOab || '').trim().toUpperCase();
    return estado ? this.tabelasOab[estado] || null : null;
  }

  get podeConverterOrcamento(): boolean {
    const status = normalizarOrcamentoStatus(this.orcamentoAtual?.status);
    return status === 'ACEITO' || status === 'CONVERTIDO_CONTRATO';
  }

  get historicoVisivel(): TimelineItem[] {
    if (this.timelineExpandida) {
      return this.historico;
    }

    return this.historico.slice(0, this.historicoResumoLimite);
  }

  get historicoOcultoCount(): number {
    return Math.max(0, this.historico.length - this.historicoResumoLimite);
  }

  get timelineResumoTexto(): string {
    if (this.historico.length <= this.historicoResumoLimite) {
      return `${this.historico.length} atividade${this.historico.length === 1 ? '' : 's'} no historico`;
    }

    if (this.timelineExpandida) {
      return `${this.historico.length} atividades carregadas`;
    }

    return `Mostrando ${this.historicoResumoLimite} de ${this.historico.length} atividades`;
  }

  voltar(): void {
    void this.router.navigate(['/advogado']);
  }

  alternarTimeline(): void {
    this.timelineExpandida = !this.timelineExpandida;
  }

  salvarObservacao(): void {
    if (!this.processo || !this.novaObservacao.trim()) {
      this.snack.open('Escreva uma observacao antes de salvar.', 'OK', {
        duration: 3000,
        panelClass: ['snack-error']
      });
      return;
    }

    this.salvandoObservacoes = true;
    this.auth
      .atualizarProcesso(this.id, {
        novaObservacao: this.novaObservacao.trim()
      })
      .subscribe({
        next: () => {
          this.salvandoObservacoes = false;
          this.novaObservacao = '';
          this.snack.open('Observacao registrada no historico do processo.', 'OK', {
            duration: 2600,
            panelClass: ['snack-success']
          });
          this.carregarDetalhes(false);
          this.carregarHistorico();
        },
        error: () => {
          this.salvandoObservacoes = false;
          this.snack.open('Nao foi possivel salvar a observacao.', 'Fechar', {
            duration: 3600,
            panelClass: ['snack-error']
          });
        }
      });
  }

  alternarUrgenciaManual(): void {
    if (!this.processo) return;

    this.atualizandoPrioridade = true;

    this.auth
      .atualizarProcesso(this.id, {
        urgenteManual: !this.processo.urgenteManual,
        status:
          this.processo.statusBase === 'Urgente' && this.processo.urgenteManual
            ? 'Em Andamento'
            : this.processo.statusBase
      })
      .subscribe({
        next: () => {
          this.atualizandoPrioridade = false;
          this.snack.open(
            this.processo?.urgenteManual
              ? 'Urgencia manual removida.'
              : 'Urgencia manual ativada.',
            'OK',
            { duration: 2800, panelClass: ['snack-success'] }
          );
          this.recarregarTudo();
        },
        error: () => {
          this.atualizandoPrioridade = false;
          this.snack.open('Nao foi possivel atualizar a prioridade deste caso.', 'Fechar', {
            duration: 3600,
            panelClass: ['snack-error']
          });
        }
      });
  }

  marcarComoConcluido(): void {
    this.auth
      .atualizarProcesso(this.id, {
        status: 'Concluído',
        urgenteManual: false
      })
      .subscribe({
        next: () => {
          this.snack.open('Processo concluido com sucesso.', 'OK', {
            duration: 2800,
            panelClass: ['snack-success']
          });
          this.recarregarTudo();
        },
        error: () => {
          this.snack.open('Nao foi possivel concluir este processo.', 'Fechar', {
            duration: 3600,
            panelClass: ['snack-error']
          });
        }
      });
  }

  retomarProcesso(): void {
    this.auth
      .atualizarProcesso(this.id, {
        status: 'Em Andamento'
      })
      .subscribe({
        next: () => {
          this.snack.open('Processo retomado para a fila ativa.', 'OK', {
            duration: 2800,
            panelClass: ['snack-success']
          });
          this.recarregarTudo();
        },
        error: () => {
          this.snack.open('Nao foi possivel retomar este processo.', 'Fechar', {
            duration: 3600,
            panelClass: ['snack-error']
          });
        }
      });
  }

  editarEtapa(etapa: EtapaViewModel): void {
    this.etapaEmEdicaoId = etapa.id;
    this.novaEtapaTitulo = etapa.titulo;
    this.novaEtapaData = etapa.dataLimite;
    this.novoTipoEtapa = etapa.tipo;
    this.novoLocalEtapa = etapa.local || '';
    this.novaObservacaoEtapa = etapa.observacao || '';
    this.novoStatusEtapa = etapa.status;
    this.novaEtapaUrgente = etapa.urgenteManual && etapa.status !== 'CONCLUIDO';
    this.etapaDrawerAberto = true;
    this.focarPrimeiroCampoEtapa();
  }

  abrirNovaEtapa(): void {
    this.cancelarEdicaoEtapa();
    this.etapaDrawerAberto = true;
    this.focarPrimeiroCampoEtapa();
  }

  cancelarEdicaoEtapa(): void {
    this.etapaEmEdicaoId = null;
    this.novaEtapaTitulo = '';
    this.novaEtapaData = '';
    this.novoTipoEtapa = 'PRAZO';
    this.novoLocalEtapa = '';
    this.novaObservacaoEtapa = '';
    this.novoStatusEtapa = 'PENDENTE';
    this.novaEtapaUrgente = false;
    this.salvandoEtapa = false;
    this.etapaDrawerAberto = false;
  }

  salvarEtapa(): void {
    if (!this.novaEtapaTitulo.trim() || !this.novaEtapaData) {
      this.snack.open('Preencha titulo e data da etapa.', 'OK', {
        duration: 3000,
        panelClass: ['snack-error']
      });
      return;
    }

    this.salvandoEtapa = true;
    const etapaEmEdicao = this.etapaEmEdicaoId;
    const payload = {
      titulo: this.novaEtapaTitulo.trim(),
      dataLimite: this.novaEtapaData,
      tipo: this.novoTipoEtapa,
      local: this.novoLocalEtapa.trim() || null,
      observacao: this.novaObservacaoEtapa.trim() || null,
      status: this.novoStatusEtapa,
      urgenteManual: this.novoStatusEtapa === 'CONCLUIDO' ? false : this.novaEtapaUrgente
    };

    const request$ = etapaEmEdicao
      ? this.auth.atualizarEtapa(this.id, etapaEmEdicao, payload)
      : this.auth.criarEtapa(this.id, payload);

    request$.subscribe({
      next: () => {
        this.cancelarEdicaoEtapa();
        this.snack.open(
          etapaEmEdicao ? 'Etapa atualizada com sucesso.' : 'Etapa adicionada com sucesso.',
          'OK',
          {
            duration: 2800,
            panelClass: ['snack-success']
          }
        );
        this.carregarEtapas();
        this.carregarHistorico();
      },
      error: () => {
        this.salvandoEtapa = false;
        this.snack.open('Nao foi possivel salvar a etapa.', 'Fechar', {
          duration: 3600,
          panelClass: ['snack-error']
        });
      }
    });
  }

  alternarStatusEtapa(etapa: EtapaViewModel): void {
    const status = etapa.status === 'PENDENTE' ? 'CONCLUIDO' : 'PENDENTE';
    this.processandoEtapaId = etapa.id;

    this.auth.atualizarStatusEtapa(this.id, etapa.id, status).subscribe({
      next: () => {
        this.processandoEtapaId = null;
        this.carregarEtapas();
        this.carregarHistorico();
      },
      error: () => {
        this.processandoEtapaId = null;
        this.snack.open('Nao foi possivel atualizar esta etapa.', 'Fechar', {
          duration: 3600,
          panelClass: ['snack-error']
        });
      }
    });
  }

  alternarUrgenciaEtapa(etapa: EtapaViewModel): void {
    if (etapa.status === 'CONCLUIDO') {
      return;
    }

    this.processandoEtapaId = etapa.id;
    this.auth
      .atualizarEtapa(this.id, etapa.id, {
        urgenteManual: !etapa.urgenteManual
      })
      .subscribe({
        next: () => {
          this.processandoEtapaId = null;
          this.carregarEtapas();
          this.carregarHistorico();
        },
        error: () => {
          this.processandoEtapaId = null;
          this.snack.open('Nao foi possivel ajustar a urgencia desta etapa.', 'Fechar', {
            duration: 3600,
            panelClass: ['snack-error']
          });
        }
      });
  }

  excluirEtapa(etapa: EtapaViewModel): void {
    if (!confirm(`Remover a etapa "${etapa.titulo}"?`)) return;

    this.processandoEtapaId = etapa.id;
    this.auth.excluirEtapa(this.id, etapa.id).subscribe({
      next: () => {
        this.processandoEtapaId = null;
        if (this.etapaEmEdicaoId === etapa.id) {
          this.cancelarEdicaoEtapa();
        }
        this.snack.open('Etapa removida com sucesso.', 'OK', {
          duration: 2800,
          panelClass: ['snack-success']
        });
        this.carregarEtapas();
        this.carregarHistorico();
      },
      error: () => {
        this.processandoEtapaId = null;
        this.snack.open('Nao foi possivel remover esta etapa.', 'Fechar', {
          duration: 3600,
          panelClass: ['snack-error']
        });
      }
    });
  }

  aoAlterarStatusEtapaForm(status: 'PENDENTE' | 'CONCLUIDO'): void {
    this.novoStatusEtapa = status;
    if (status === 'CONCLUIDO') {
      this.novaEtapaUrgente = false;
    }
  }

  alternarUrgenciaEtapaForm(): void {
    if (this.novoStatusEtapa === 'CONCLUIDO') {
      return;
    }

    this.novaEtapaUrgente = !this.novaEtapaUrgente;
  }

  deletarProcesso(): void {
    if (!confirm('Deseja remover este processo?')) return;

    this.auth.excluirProcesso(this.id).subscribe({
      next: () => void this.router.navigate(['/advogado']),
      error: () => {
        this.snack.open('Nao foi possivel remover este processo.', 'Fechar', {
          duration: 3600,
          panelClass: ['snack-error']
        });
      }
    });
  }

  estaAtrasado(data: string, status: string): boolean {
    if (status === 'CONCLUIDO') return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataEtapa = new Date(`${data}T12:00:00`);
    dataEtapa.setHours(0, 0, 0, 0);
    return dataEtapa.getTime() < hoje.getTime();
  }

  estaUrgente(data: string, status: string): boolean {
    if (status === 'CONCLUIDO') return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataEtapa = new Date(`${data}T12:00:00`);
    dataEtapa.setHours(0, 0, 0, 0);
    const diff = Math.ceil((dataEtapa.getTime() - hoje.getTime()) / 86400000);
    return diff >= 0 && diff <= 2;
  }

  etapaEstaUrgente(etapa: EtapaViewModel): boolean {
    if (etapa.status === 'CONCLUIDO') return false;
    return etapa.urgenteManual || this.estaUrgente(etapa.dataLimite, etapa.status);
  }

  etapaCardClass(etapa: EtapaViewModel): string {
    if (etapa.status === 'CONCLUIDO') return 'is-complete';
    if (this.estaAtrasado(etapa.dataLimite, etapa.status)) return 'is-overdue';
    if (this.etapaEstaUrgente(etapa)) return 'is-urgent';
    return 'is-neutral';
  }

  etapaStatusLabel(etapa: EtapaViewModel): string {
    if (etapa.status === 'CONCLUIDO') return 'Concluida';
    if (this.estaAtrasado(etapa.dataLimite, etapa.status)) return 'Atrasada';
    if (etapa.urgenteManual) return 'Urgencia manual';
    if (this.estaUrgente(etapa.dataLimite, etapa.status)) return 'Urgente';
    return 'Pendente';
  }

  etapaStatusIcone(etapa: EtapaViewModel): string {
    if (etapa.status === 'CONCLUIDO') return 'check_circle';
    if (this.estaAtrasado(etapa.dataLimite, etapa.status)) return 'error';
    if (etapa.urgenteManual) return 'outlined_flag';
    if (this.estaUrgente(etapa.dataLimite, etapa.status)) return 'priority_high';
    return 'schedule';
  }

  etapaAcaoPrincipal(etapa: EtapaViewModel): string {
    return etapa.status === 'CONCLUIDO' ? 'Reabrir' : 'Concluir';
  }

  etapaUrgenciaTexto(etapa: EtapaViewModel): string {
    return etapa.urgenteManual ? 'Remover urgencia' : 'Marcar urgente';
  }

  etapaResumoAuxiliar(etapa: EtapaViewModel): string {
    if (etapa.status === 'CONCLUIDO') {
      return 'Fluxo concluido e registrado na timeline.';
    }

    if (this.estaAtrasado(etapa.dataLimite, etapa.status)) {
      return 'Compromisso vencido e precisando de acao imediata.';
    }

    if (etapa.urgenteManual) {
      return 'Prioridade manual mantida ate revisao do advogado.';
    }

    if (this.estaUrgente(etapa.dataLimite, etapa.status)) {
      return 'Janela curta para execucao.';
    }

    return 'Etapa em acompanhamento operacional.';
  }

  statusBadgeClass(status: ProcessoStatusVisual): string {
    return obterMetaStatus(status).badgeClass;
  }

  statusIcon(status: ProcessoStatusVisual): string {
    return obterMetaStatus(status).icon;
  }

  compromissoIcon(tipo: 'PRAZO' | 'AUDIENCIA' | 'EVENTO' | 'DOCUMENTO'): string {
    switch (tipo) {
      case 'AUDIENCIA':
        return 'gavel';
      case 'EVENTO':
        return 'event';
      case 'DOCUMENTO':
        return 'description';
      default:
        return 'schedule';
    }
  }

  timelineToneClass(item: TimelineItem): string {
    return `tone-${item.tonalidade}`;
  }

  categoriaEtapaLabel(tipo: 'PRAZO' | 'AUDIENCIA' | 'EVENTO' | 'DOCUMENTO'): string {
    return categoriaCompromissoLabel(tipo);
  }

  async gerarDocumento(template: DocumentTemplateDefinition): Promise<void> {
    if (!this.processo || !this.clienteDetalhe || !this.auth.currentUser) {
      this.snack.open('Carregue o cliente vinculado para gerar o documento.', 'Fechar', {
        duration: 3200,
        panelClass: ['snack-error']
      });
      return;
    }

    this.gerandoDocumento = true;

    try {
      await this.documentGenerator.download(template, this.clienteDetalhe, this.auth.currentUser, {
        localAssinatura:
          this.clienteDetalhe.cidade || this.processo.localCompromisso || 'Cidade',
        referenciaProcesso: this.processo.id || this.processo.tipo,
        objetoContrato: this.orcamentoForm.descricaoServico.trim() || this.processo.tipo,
        contratoValor: this.orcamentoForm.valor.trim(),
        contratoValorExtenso: ''
      });

      try {
        await firstValueFrom(
          this.auth.registrarDocumentoGerado(this.id, {
            templateId: template.id,
            templateNome: template.title
          })
        );
        this.carregarHistorico();
      } catch (error) {
        console.warn('[DetalhesProcesso] Documento gerado sem auditoria no backend', error);
      }

      this.snack.open('Documento gerado com sucesso.', 'OK', {
        duration: 2800,
        panelClass: ['snack-success']
      });
    } catch (error) {
      this.snack.open('Nao foi possivel gerar o documento agora.', 'Fechar', {
        duration: 3600,
        panelClass: ['snack-error']
      });
    } finally {
      this.gerandoDocumento = false;
    }
  }

  salvarOrcamento(acao: 'SALVAR_RASCUNHO' | 'AGUARDAR_RESPOSTA' | 'MARCAR_ACEITO' | 'MARCAR_RECUSADO' = 'SALVAR_RASCUNHO'): void {
    if (!this.processo) {
      return;
    }

    if (!this.orcamentoForm.valor.trim()) {
      this.snack.open('Informe o valor do orcamento antes de salvar.', 'OK', {
        duration: 3200,
        panelClass: ['snack-error']
      });
      return;
    }

    if (!this.orcamentoForm.descricaoServico.trim()) {
      this.snack.open('Descreva o escopo do servico para registrar o orcamento.', 'OK', {
        duration: 3200,
        panelClass: ['snack-error']
      });
      return;
    }

    const statusMap: Record<
      'SALVAR_RASCUNHO' | 'AGUARDAR_RESPOSTA' | 'MARCAR_ACEITO' | 'MARCAR_RECUSADO',
      OrcamentoStatus
    > = {
      SALVAR_RASCUNHO: 'RASCUNHO',
      AGUARDAR_RESPOSTA: 'AGUARDANDO_RESPOSTA_CLIENTE',
      MARCAR_ACEITO: 'ACEITO',
      MARCAR_RECUSADO: 'RECUSADO'
    };

    this.salvandoOrcamento = true;
    this.auth
      .salvarOrcamentoProcesso(this.id, {
        valor: this.orcamentoForm.valor,
        descricaoServico: this.orcamentoForm.descricaoServico.trim(),
        observacoes: this.orcamentoForm.observacoes.trim(),
        estadoOab: this.orcamentoForm.estadoOab || null,
        status: statusMap[acao],
        acao
      })
      .subscribe({
        next: (orcamento: any) => {
          this.salvandoOrcamento = false;
          this.processo = this.processo
            ? ({
                ...this.processo,
                orcamento
              } as ProcessoViewModel)
            : this.processo;
          this.sincronizarOrcamentoForm();
          this.carregarHistorico();
          this.snack.open(this.mensagemSucessoOrcamento(acao), 'OK', {
            duration: 3200,
            panelClass: ['snack-success']
          });
        },
        error: (error) => {
          this.salvandoOrcamento = false;
          this.snack.open(error?.error?.mensagem || 'Nao foi possivel salvar o orcamento.', 'Fechar', {
            duration: 4000,
            panelClass: ['snack-error']
          });
        }
      });
  }

  consultarTabelaOab(): void {
    if (this.carregandoHonorarios) {
      this.snack.open('Aguarde o carregamento dos links da OAB.', 'OK', {
        duration: 2600,
        panelClass: ['snack-error']
      });
      return;
    }

    const estado = (this.orcamentoForm.estadoOab || '').trim().toUpperCase();
    const link = this.tabelasOab[estado];

    if (!estado) {
      this.snack.open('Selecione a UF da tabela OAB antes da consulta.', 'OK', {
        duration: 2800,
        panelClass: ['snack-error']
      });
      return;
    }

    if (!link) {
      this.snack.open(`Nenhum link da tabela OAB foi configurado para ${estado}.`, 'OK', {
        duration: 3200,
        panelClass: ['snack-error']
      });
      return;
    }

    if (!/^https?:\/\//i.test(link)) {
      this.snack.open(`O link configurado para ${estado} esta invalido.`, 'Fechar', {
        duration: 3600,
        panelClass: ['snack-error']
      });
      return;
    }

    this.orcamentoForm.estadoOab = estado;
    window.open(link, '_blank', 'noopener');
  }

  async converterOrcamentoEmContrato(): Promise<void> {
    if (!this.processo || !this.clienteDetalhe || !this.auth.currentUser || !this.contratoTemplate) {
      this.snack.open('Carregue processo, cliente e sessao para gerar o contrato.', 'Fechar', {
        duration: 3400,
        panelClass: ['snack-error']
      });
      return;
    }

    if (!this.podeConverterOrcamento) {
      this.snack.open('O orcamento precisa estar aceito para virar contrato.', 'OK', {
        duration: 3200,
        panelClass: ['snack-error']
      });
      return;
    }

    this.convertendoOrcamento = true;

    try {
      await this.documentGenerator.download(this.contratoTemplate, this.clienteDetalhe, this.auth.currentUser, {
        localAssinatura:
          this.clienteDetalhe.cidade || this.processo.localCompromisso || 'Cidade',
        referenciaProcesso: this.processo.id || this.processo.tipo,
        objetoContrato: this.orcamentoForm.descricaoServico.trim() || this.processo.tipo,
        contratoValor: this.orcamentoForm.valor.trim(),
        contratoValorExtenso: ''
      });

      const orcamento = await firstValueFrom(
        this.auth.converterOrcamentoEmContrato(this.id, {
          templateId: this.contratoTemplate.id,
          templateNome: this.contratoTemplate.title
        })
      );

      this.processo = this.processo
        ? ({
            ...this.processo,
            orcamento
          } as ProcessoViewModel)
        : this.processo;
      this.sincronizarOrcamentoForm();
      this.carregarHistorico();

      this.snack.open('Contrato de honorarios gerado e vinculado ao orcamento.', 'OK', {
        duration: 3600,
        panelClass: ['snack-success']
      });
    } catch (error: any) {
      this.snack.open(
        error?.error?.mensagem || error?.message || 'Nao foi possivel converter o orcamento em contrato.',
        'Fechar',
        {
          duration: 4200,
          panelClass: ['snack-error']
        }
      );
    } finally {
      this.convertendoOrcamento = false;
    }
  }

  orcamentoStatusBadgeClass(status?: string | null): string {
    return this.obterMetaOrcamentoLocal(status).badgeClass;
  }

  orcamentoStatusIcon(status?: string | null): string {
    return this.obterMetaOrcamentoLocal(status).icon;
  }

  orcamentoStatusTexto(status?: string | null): string {
    return this.obterMetaOrcamentoLocal(status).label;
  }

  valorOrcamentoFormatado(valor?: number | null): string {
    return formatarMoeda(valor);
  }

  private recarregarTudo(): void {
    this.carregando = true;
    this.carregarDetalhes();
    this.carregarEtapas();
    this.carregarHistorico();
  }

  private carregarTabelasOab(): void {
    this.carregandoHonorarios = true;
    this.erroTabelasOab = '';
    this.auth.pegarTabelasOAB().subscribe({
      next: (links) => {
        this.tabelasOab = links || {};
        if (
          this.orcamentoForm.estadoOab &&
          !this.tabelasOab[this.orcamentoForm.estadoOab.trim().toUpperCase()]
        ) {
          this.orcamentoForm.estadoOab = '';
        }
        this.carregandoHonorarios = false;
      },
      error: () => {
        this.tabelasOab = {};
        this.carregandoHonorarios = false;
        this.erroTabelasOab =
          'Nao foi possivel carregar os links oficiais da OAB a partir do Firestore.';
        this.snack.open(this.erroTabelasOab, 'Fechar', {
          duration: 4000,
          panelClass: ['snack-error']
        });
      }
    });
  }

  private carregarDetalhes(mostrarLoader = true): void {
    if (mostrarLoader) {
      this.carregando = true;
    }

    this.auth.pegarProcessoPeloId(this.id).subscribe({
      next: (dados) => {
        this.processo = mapearProcessoParaTela(dados as ProcessoApiModel);
        this.sincronizarOrcamentoForm();
        this.carregarClienteRelacionado();
        if (this.historico.length === 0) {
          this.historico = this.montarHistoricoFallback();
        }
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.snack.open('Nao foi possivel carregar os detalhes do processo.', 'Fechar', {
          duration: 3600,
          panelClass: ['snack-error']
        });
      }
    });
  }

  private carregarEtapas(): void {
    this.auth.listarEtapas(this.id).subscribe({
      next: (dados) => {
        const etapas = Array.isArray(dados) ? (dados as EtapaViewModel[]) : [];
        this.listaEtapas = etapas
          .map((etapa) => ({
            id: etapa.id,
            titulo: etapa.titulo,
            dataLimite: etapa.dataLimite,
            status: etapa.status || 'PENDENTE',
            tipo: etapa.tipo || 'PRAZO',
            local: etapa.local || null,
            observacao: etapa.observacao || null,
            urgenteManual: etapa.urgenteManual === true,
            atualizadoEm: etapa.atualizadoEm || null
          }))
          .sort((primeira, segunda) => {
            if (primeira.status !== segunda.status) {
              return primeira.status === 'CONCLUIDO' ? 1 : -1;
            }

            const dataPrimeira = new Date(`${primeira.dataLimite}T12:00:00`).getTime();
            const dataSegunda = new Date(`${segunda.dataLimite}T12:00:00`).getTime();
            return dataPrimeira - dataSegunda;
          });
      },
      error: () => {
        this.listaEtapas = [];
      }
    });
  }

  private carregarHistorico(): void {
    this.auth.listarHistoricoProcesso(this.id).subscribe({
      next: (dados) => {
        const registros = Array.isArray(dados) ? (dados as HistoricoRegistroApi[]) : [];
        this.historico = registros.length
          ? registros.map((item) => mapearHistoricoParaTimeline(item))
          : this.montarHistoricoFallback();
      },
      error: () => {
        this.historico = this.montarHistoricoFallback();
      }
    });
  }

  private carregarClienteRelacionado(): void {
    if (!this.processo?.clienteId) {
      this.clienteDetalhe = null;
      return;
    }

    this.auth.listarClientes().subscribe({
      next: (clientes) => {
        this.clienteDetalhe =
          clientes.find((cliente) => cliente.id === this.processo?.clienteId) || null;
        if (!this.orcamentoForm.estadoOab && this.clienteDetalhe?.estado) {
          this.orcamentoForm.estadoOab = this.clienteDetalhe.estado.trim().toUpperCase();
        }
      },
      error: () => {
        this.clienteDetalhe = null;
      }
    });
  }

  private sincronizarOrcamentoForm(): void {
    const orcamento = this.processo?.orcamento;

    this.orcamentoForm = {
      valor:
        typeof orcamento?.valor === 'number' && !Number.isNaN(orcamento.valor)
          ? new Intl.NumberFormat('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }).format(orcamento.valor)
          : '',
      descricaoServico: orcamento?.descricaoServico || '',
      observacoes: orcamento?.observacoes || '',
      status: normalizarOrcamentoStatus(orcamento?.status),
      estadoOab: (orcamento?.estadoOab || this.orcamentoForm.estadoOab || '').trim().toUpperCase()
    };
  }

  private obterMetaOrcamentoLocal(status?: string | null): {
    icon: string;
    badgeClass: string;
    label: string;
  } {
    const valor = normalizarOrcamentoStatus(status);
    switch (valor) {
      case 'ACEITO':
        return { icon: 'task_alt', badgeClass: 'is-complete', label: 'Aceito' };
      case 'RECUSADO':
        return { icon: 'block', badgeClass: 'is-overdue', label: 'Recusado' };
      case 'CONVERTIDO_CONTRATO':
        return { icon: 'description', badgeClass: 'is-progress', label: 'Convertido em contrato' };
      case 'ENVIADO_CLIENTE':
        return { icon: 'forward_to_inbox', badgeClass: 'is-progress', label: 'Enviado ao cliente' };
      case 'AGUARDANDO_RESPOSTA_CLIENTE':
        return { icon: 'hourglass_top', badgeClass: 'is-urgent', label: 'Aguardando resposta do cliente' };
      default:
        return { icon: 'edit_note', badgeClass: 'is-neutral', label: 'Rascunho' };
    }
  }

  private mensagemSucessoOrcamento(
    acao: 'SALVAR_RASCUNHO' | 'AGUARDAR_RESPOSTA' | 'MARCAR_ACEITO' | 'MARCAR_RECUSADO'
  ): string {
    switch (acao) {
      case 'AGUARDAR_RESPOSTA':
        return 'Orcamento salvo e marcado como aguardando resposta do cliente.';
      case 'MARCAR_ACEITO':
        return 'Orcamento marcado como aceito.';
      case 'MARCAR_RECUSADO':
        return 'Orcamento marcado como recusado.';
      case 'SALVAR_RASCUNHO':
      default:
        return 'Orcamento salvo como rascunho.';
    }
  }

  private montarHistoricoFallback(): TimelineItem[] {
    if (!this.processo) {
      return [];
    }

    const itens: TimelineItem[] = [];

    if (this.processo.criadoEm) {
      itens.push({
        id: 'fallback-criar',
        data: this.processo.criadoEm,
        titulo: 'Processo criado',
        descricao: 'Cadastro inicial do caso realizado na base.',
        icone: 'note_add',
        tonalidade: 'info'
      });
    }

    if (this.processo.urgenteManual) {
      itens.push({
        id: 'fallback-urgente',
        data: this.processo.atualizadoEm || new Date().toISOString(),
        titulo: 'Urgencia manual ativa',
        descricao: 'A prioridade do caso esta sendo mantida manualmente pela equipe.',
        icone: 'priority_high',
        tonalidade: 'warning'
      });
    }

    return itens;
  }

  private focarPrimeiroCampoEtapa(): void {
    setTimeout(() => {
      this.etapaTituloInput?.nativeElement?.focus();
      this.etapaTituloInput?.nativeElement?.select();
    }, 80);
  }
}
