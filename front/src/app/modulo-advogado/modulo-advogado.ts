import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, NativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../auth.service';
import { AppUser } from '../models/app-user.model';
import { ClienteRecord } from '../models/client.model';
import { ClientesWorkspaceComponent } from '../features/workspace/clientes-workspace/clientes-workspace.component';
import { DocumentosWorkspaceComponent } from '../features/workspace/documentos-workspace/documentos-workspace.component';
import { AgendaCalendarioComponent } from './agenda-calendario/agenda-calendario.component';
import {
  AgendaEvento,
  CategoriaCompromisso,
  ProcessoApiModel,
  ProcessoStatusVisual,
  ProcessoViewModel,
  THEME_OPTIONS,
  ThemeOption,
  categoriaCompromissoLabel,
  compararProcessosPorPrioridade,
  formatarResumoPrazo,
  mapearProcessoParaTela,
  obterMetaStatus,
  processarAgendaEvento,
  tempoRelativo
} from '../shared/processo-ui';

export const MEU_FORMATO_BR = {
  parse: {
    dateInput: 'DD/MM/YYYY'
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'DD/MM/YYYY',
    monthYearA11yLabel: 'MMMM YYYY'
  }
};

type FiltroPrincipal =
  | 'Todos'
  | 'Aguardando An\u00E1lise'
  | 'Em Andamento'
  | 'Urgente'
  | 'Atrasado'
  | 'Conclu\u00EDdo';

interface Notificacao {
  id: string;
  idProcesso: string;
  cliente: string;
  texto: string;
  detalhe: string;
  icone: string;
  classe: string;
  lida: boolean;
  timestamp: number;
  prioridade: number;
  status: ProcessoStatusVisual;
}

interface GrupoNotificacao {
  titulo: string;
  itens: Notificacao[];
}

interface ResumoDiario {
  atrasados: number;
  urgentes: number;
  hoje: number;
  texto: string;
  visivel: boolean;
}

interface KPIItem {
  titulo: string;
  valor: number;
  apoio: string;
  icone: string;
  classe: string;
}

interface ProcessoClienteForm {
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

type SidebarSection = 'dashboard' | 'processos' | 'clientes' | 'agenda' | 'documentos';

@Component({
  selector: 'app-modulo-advogado',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatMenuModule,
    MatDatepickerModule,
    NativeDateModule,
    MatSnackBarModule,
    AgendaCalendarioComponent,
    ClientesWorkspaceComponent,
    DocumentosWorkspaceComponent
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
    { provide: MAT_DATE_FORMATS, useValue: MEU_FORMATO_BR }
  ],
  templateUrl: './modulo-advogado.html',
  styleUrls: ['./modulo-advogado.scss']
})
export class ModuloAdvogadoComponent implements OnInit, OnDestroy {
  readonly themeOptions = THEME_OPTIONS;
  readonly processosPorPagina = 15;

  listaDeProcessosRaw: ProcessoViewModel[] = [];
  listaDeProcessosFiltrada: ProcessoViewModel[] = [];
  agendaEventos: AgendaEvento[] = [];
  processosPrioritarios: ProcessoViewModel[] = [];

  mostrarFiltroAvancado = false;
  filtroAtual: FiltroPrincipal = 'Todos';
  filtroNomeCliente = '';
  filtroTipoAcao = '';
  filtroStatusAvancado: FiltroPrincipal | 'Todos' = 'Todos';
  filtroCategoriaCompromisso: 'Todos' | CategoriaCompromisso = 'Todos';
  filtroDataInicial: Date | null = null;
  filtroDataFinal: Date | null = null;

  countAtivos = 0;
  countConcluidos = 0;
  countUrgentes = 0;
  countAtrasados = 0;
  countHoje = 0;

  notificacoes: Notificacao[] = [];
  notificacoesAgrupadas: GrupoNotificacao[] = [];
  notificacoesNaoLidas = 0;
  notificacaoAtual: Notificacao | null = null;
  notificacaoAtiva = false;
  painelNotificacoesAberto = false;
  toastJaMostradoSessao = false;
  idsNotificacoesLidas: string[] = [];

  resumoDiario: ResumoDiario = {
    atrasados: 0,
    urgentes: 0,
    hoje: 0,
    texto: '',
    visivel: false
  };

  mostrarFormulario = false;
  idEmEdicao: string | null = null;
  processoEmAcaoId: string | null = null;
  salvandoProcesso = false;
  carregandoClientes = false;
  clientesDisponiveis: ClienteRecord[] = [];
  clienteSelecionadoId: string | null = null;
  buscaCliente = '';

  novoTipo = '';
  novaObservacao = '';
  novoPrazo: Date | null = null;
  novoStatus: ProcessoStatusVisual = 'Aguardando An\u00E1lise';
  novaCategoriaCompromisso: CategoriaCompromisso = 'PRAZO';
  novoLocalCompromisso = '';
  urgenteManualForm = false;
  clienteForm: ProcessoClienteForm = this.criarClienteFormVazio();

  totalResultados = 0;
  paginaAtualProcessos = 1;
  temaAtual: ThemeOption['value'] = 'corporate';
  currentUser: AppUser | null = null;
  activeSidebarSection: SidebarSection = 'dashboard';

  private userSub?: Subscription;
  private filtroSub?: Subscription;
  private routeDataSub?: Subscription;
  private readonly filtroSubject = new Subject<void>();

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private snack: MatSnackBar
  ) {}

  ngOnInit(): void {
    const temaSalvo = localStorage.getItem('justapro-theme') as ThemeOption['value'] | null;
    this.mudarTema(temaSalvo || 'corporate');
    this.iniciarInteligenciaNotificacoes();
    this.pedirPermissaoNotificacao();

    this.userSub = this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
    });

    this.routeDataSub = this.route.data.subscribe((data) => {
      this.activeSidebarSection = this.mapSidebarSection(data['sidebarSection']);
    });

    this.filtroSub = this.filtroSubject
      .pipe(debounceTime(220))
      .subscribe(() => this.executarFiltros(true));

    this.carregarClientes();
    this.carregarDados();
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.filtroSub?.unsubscribe();
    this.routeDataSub?.unsubscribe();
  }

  get kpis(): KPIItem[] {
    return [
      {
        titulo: 'Casos ativos',
        valor: this.countAtivos,
        apoio: 'Base em andamento',
        icone: 'folder_open',
        classe: 'progress'
      },
      {
        titulo: 'Urgentes',
        valor: this.countUrgentes,
        apoio: 'Precisam de priorizacao',
        icone: 'priority_high',
        classe: 'urgent'
      },
      {
        titulo: 'Atrasados',
        valor: this.countAtrasados,
        apoio: 'Prazos ja vencidos',
        icone: 'error_outline',
        classe: 'overdue'
      },
      {
        titulo: 'Conclu\u00EDdos',
        valor: this.countConcluidos,
        apoio: 'Casos finalizados',
        icone: 'task_alt',
        classe: 'complete'
      }
    ];
  }

  get temaAtualLabel(): string {
    return this.themeOptions.find((option) => option.value === this.temaAtual)?.label || 'Tema';
  }

  get topbarTitulo(): string {
    switch (this.activeSidebarSection) {
      case 'agenda':
        return 'Agenda juridica dedicada';
      case 'clientes':
        return 'Base de clientes do escritorio';
      case 'documentos':
        return 'Documentos juridicos editaveis';
      case 'processos':
        return 'Pipeline completo dos processos';
      default:
        return 'Mesa de controle dos processos';
    }
  }

  get topbarDescricao(): string {
    switch (this.activeSidebarSection) {
      case 'agenda':
        return 'Calendario ampliado, leitura mais clara dos eventos e painel lateral com foco operacional no dia.';
      case 'clientes':
        return 'Cadastre dados essenciais do cliente e mantenha a base pronta para automacoes e documentos.';
      case 'documentos':
        return 'Selecione um modelo, puxe os dados do cliente e gere um DOCX pronto para edicao externa.';
      case 'processos':
        return 'Acompanhe cada caso com alertas inteligentes, filtros avancados e acoes operacionais em um so fluxo.';
      default:
        return 'Decisoes mais rapidas, prazos sob controle e leitura clara do que exige acao agora.';
    }
  }

  get proximosCompromissos(): AgendaEvento[] {
    return this.agendaEventos.slice(0, 5);
  }

  get clientesFiltrados(): ClienteRecord[] {
    const termo = this.normalizarTextoBusca(this.buscaCliente);
    const termoDigitos = this.extrairDigitos(this.buscaCliente);
    if (!termo) {
      return this.clientesDisponiveis;
    }

    return this.clientesDisponiveis.filter((cliente) => {
      const documento = this.extrairDigitos(`${cliente.cpf || ''}${cliente.documentoSecundario || ''}`);
      const correspondeDocumento = termoDigitos ? documento.includes(termoDigitos) : false;
      return (
        this.normalizarTextoBusca(cliente.nome).includes(termo) ||
        this.normalizarTextoBusca(cliente.email || '').includes(termo) ||
        correspondeDocumento
      );
    });
  }

  get clientesBuscaDrawer(): ClienteRecord[] {
    if (!this.buscaCliente.trim() || this.clienteSelecionadoId) {
      return [];
    }

    return this.clientesFiltrados.slice(0, 6);
  }

  get mostrarBuscaClienteVazia(): boolean {
    return (
      !this.carregandoClientes &&
      !this.clienteSelecionadoId &&
      !!this.buscaCliente.trim() &&
      this.clientesBuscaDrawer.length === 0
    );
  }

  get processosPaginados(): ProcessoViewModel[] {
    const inicio = (this.paginaAtualProcessos - 1) * this.processosPorPagina;
    return this.listaDeProcessosFiltrada.slice(inicio, inicio + this.processosPorPagina);
  }

  get totalPaginasProcessos(): number {
    return Math.max(1, Math.ceil(this.listaDeProcessosFiltrada.length / this.processosPorPagina));
  }

  get resumoPaginacaoProcessos(): string {
    if (this.listaDeProcessosFiltrada.length === 0) {
      return 'Nenhum processo encontrado';
    }

    const inicio = (this.paginaAtualProcessos - 1) * this.processosPorPagina + 1;
    const fim = Math.min(
      this.paginaAtualProcessos * this.processosPorPagina,
      this.listaDeProcessosFiltrada.length
    );

    return `Mostrando ${inicio}-${fim} de ${this.listaDeProcessosFiltrada.length} processo(s)`;
  }

  private mapSidebarSection(value: unknown): SidebarSection {
    if (
      value === 'processos' ||
      value === 'clientes' ||
      value === 'agenda' ||
      value === 'documentos'
    ) {
      return value;
    }
    return 'dashboard';
  }

  get filtrosAtivosCount(): number {
    let total = 0;
    if (this.filtroNomeCliente.trim()) total++;
    if (this.filtroTipoAcao.trim()) total++;
    if (this.filtroStatusAvancado !== 'Todos') total++;
    if (this.filtroCategoriaCompromisso !== 'Todos') total++;
    if (this.filtroDataInicial) total++;
    if (this.filtroDataFinal) total++;
    if (this.filtroAtual !== 'Todos') total++;
    return total;
  }

  get temFiltrosAtivos(): boolean {
    return this.filtrosAtivosCount > 0;
  }

  iniciaisDoNome(nome?: string | null): string {
    if (!nome) return '?';

    return nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() || '')
      .join('');
  }

  mudarTema(tema: ThemeOption['value']): void {
    this.temaAtual = tema;
    document.body.setAttribute('data-theme', tema);
    document.documentElement.style.colorScheme = tema === 'light' ? 'light' : 'dark';
    localStorage.setItem('justapro-theme', tema);
  }

  toggleFiltroAvancado(): void {
    this.mostrarFiltroAvancado = !this.mostrarFiltroAvancado;
  }

  scheduleFiltro(): void {
    this.filtroSubject.next();
  }

  aplicarFiltro(status: FiltroPrincipal): void {
    this.filtroAtual = status;
    this.executarFiltros(true);
  }

  limparFiltrosAvancados(): void {
    this.filtroNomeCliente = '';
    this.filtroTipoAcao = '';
    this.filtroStatusAvancado = 'Todos';
    this.filtroCategoriaCompromisso = 'Todos';
    this.filtroDataInicial = null;
    this.filtroDataFinal = null;
    this.filtroAtual = 'Todos';
    this.executarFiltros(true);
  }

  abrirNovoProcesso(): void {
    this.cancelarEdicao();
    this.mostrarFormulario = true;
  }

  paginaAnteriorProcessos(): void {
    if (this.paginaAtualProcessos <= 1) {
      return;
    }

    this.paginaAtualProcessos -= 1;
  }

  proximaPaginaProcessos(): void {
    if (this.paginaAtualProcessos >= this.totalPaginasProcessos) {
      return;
    }

    this.paginaAtualProcessos += 1;
  }

  abrirNovoCliente(): void {
    void this.router.navigate(['/advogado/clientes']);
  }

  abrirCentralDocumentos(): void {
    void this.router.navigate(['/advogado/documentos']);
  }

  togglePainelNotificacoes(): void {
    this.painelNotificacoesAberto = !this.painelNotificacoesAberto;
  }

  fecharPainelNotificacoes(): void {
    this.painelNotificacoesAberto = false;
  }

  prepararEdicao(proc: ProcessoViewModel): void {
    this.idEmEdicao = proc.id;
    this.novoTipo = proc.tipo || proc.titulo || '';
    this.novaObservacao = proc.descricao || '';
    this.novoPrazo = proc.prazo ? new Date(`${proc.prazo}T12:00:00`) : null;
    this.novoStatus = proc.statusBase;
    this.novaCategoriaCompromisso = proc.categoriaCompromisso;
    this.novoLocalCompromisso = proc.localCompromisso || '';
    this.urgenteManualForm = proc.urgenteManual;

    const clienteAtual = this.clientesDisponiveis.find((cliente) => cliente.id === proc.clienteId);
    this.clienteSelecionadoId = clienteAtual?.id || null;
    this.clienteForm = {
      nome: clienteAtual?.nome || proc.cliente || proc.clienteId || '',
      cpfCnpj: clienteAtual?.cpf || clienteAtual?.documentoSecundario || '',
      telefone: clienteAtual?.telefone || '',
      email: clienteAtual?.email || '',
      endereco: clienteAtual?.endereco || '',
      numero: clienteAtual?.numero || '',
      complemento: clienteAtual?.complemento || '',
      bairro: clienteAtual?.bairro || '',
      cidade: clienteAtual?.cidade || '',
      estado: clienteAtual?.estado || '',
      cep: clienteAtual?.cep || ''
    };

    this.mostrarFormulario = true;
  }

  fecharFormulario(): void {
    this.mostrarFormulario = false;
    this.cancelarEdicao();
  }

  cancelarEdicao(): void {
    this.idEmEdicao = null;
    this.novoTipo = '';
    this.novaObservacao = '';
    this.novoPrazo = null;
    this.novoStatus = 'Aguardando An\u00E1lise';
    this.novaCategoriaCompromisso = 'PRAZO';
    this.novoLocalCompromisso = '';
    this.urgenteManualForm = false;
    this.clienteSelecionadoId = null;
    this.buscaCliente = '';
    this.clienteForm = this.criarClienteFormVazio();
    this.salvandoProcesso = false;
  }

  salvar(): void {
    if (!this.clienteForm.nome.trim() || !this.novoTipo.trim()) {
      this.snack.open('Preencha os dados principais do cliente e o tipo da acao.', 'OK', {
        duration: 3200,
        panelClass: ['snack-error']
      });
      return;
    }

    this.salvandoProcesso = true;

    const payload = {
      titulo: this.novoTipo.trim(),
      descricao: this.novaObservacao.trim(),
      prazo: this.novoPrazo ? this.formatarDataParaApi(this.novoPrazo) : null,
      status: this.novoStatus,
      urgenteManual: this.novoStatus === 'Conclu\u00EDdo' ? false : this.urgenteManualForm,
      categoriaCompromisso: this.novaCategoriaCompromisso,
      localCompromisso: this.novoLocalCompromisso.trim() || null,
      clienteId: this.clienteSelecionadoId,
      clienteNome: this.clienteForm.nome.trim(),
      cliente: {
        id: this.clienteSelecionadoId,
        nome: this.clienteForm.nome.trim(),
        cpfCnpj: this.clienteForm.cpfCnpj.trim() || null,
        telefone: this.clienteForm.telefone.trim() || null,
        email: this.clienteForm.email.trim() || null,
        endereco: this.clienteForm.endereco.trim() || null,
        numero: this.clienteForm.numero.trim() || null,
        complemento: this.clienteForm.complemento.trim() || null,
        bairro: this.clienteForm.bairro.trim() || null,
        cidade: this.clienteForm.cidade.trim() || null,
        estado: this.clienteForm.estado.trim().toUpperCase() || null,
        cep: this.clienteForm.cep.trim() || null
      }
    };

    const request$ = this.idEmEdicao
      ? this.authService.atualizarProcesso(this.idEmEdicao, payload)
      : this.authService.salvarProcesso(payload);

    request$.subscribe({
      next: () => {
        this.snack.open(
          this.idEmEdicao ? 'Processo atualizado com sucesso.' : 'Processo cadastrado com sucesso.',
          'OK',
          { duration: 3000, panelClass: ['snack-success'] }
        );
        this.carregarClientes();
        this.fecharFormulario();
        this.carregarDados();
      },
      error: () => {
        this.salvandoProcesso = false;
        this.snack.open('Nao foi possivel salvar este processo agora.', 'Fechar', {
          duration: 3600,
          panelClass: ['snack-error']
        });
      }
    });
  }

  alternarUrgencia(proc: ProcessoViewModel, event?: Event): void {
    event?.stopPropagation();

    if (!this.podeAlternarUrgencia(proc)) {
      return;
    }

    const urgenteManual = !proc.urgenteManual;
    const statusBase =
      proc.statusBase === 'Urgente' && !urgenteManual ? 'Em Andamento' : proc.statusBase;

    this.processoEmAcaoId = proc.id;
    this.authService
      .atualizarProcesso(proc.id, {
        urgenteManual,
        status: statusBase
      })
      .subscribe({
        next: () => {
          this.snack.open(
            urgenteManual
              ? 'Urgencia manual ativada para este processo.'
              : 'Urgencia manual removida. O caso voltou a regra automatica.',
            'OK',
            { duration: 3200, panelClass: ['snack-success'] }
          );
          this.carregarDados();
        },
        error: () => {
          this.processoEmAcaoId = null;
          this.snack.open('Nao foi possivel atualizar a prioridade deste caso.', 'Fechar', {
            duration: 3600,
            panelClass: ['snack-error']
          });
        }
      });
  }

  deletar(id: string): void {
    if (!confirm('Excluir permanentemente este processo?')) {
      return;
    }

    this.processoEmAcaoId = id;
    this.authService.excluirProcesso(id).subscribe({
      next: () => {
        this.snack.open('Processo removido com sucesso.', 'OK', {
          duration: 3000,
          panelClass: ['snack-success']
        });
        this.carregarDados();
      },
      error: () => {
        this.processoEmAcaoId = null;
        this.snack.open('Nao foi possivel remover este processo.', 'Fechar', {
          duration: 3600,
          panelClass: ['snack-error']
        });
      }
    });
  }

  abrirCaso(id: string): void {
    void this.router.navigate(['/processo', id]);
  }

  abrirEventoAgenda(evento: AgendaEvento): void {
    this.abrirCaso(evento.processoId);
  }

  abrirNotificacao(notificacao: Notificacao): void {
    this.marcarNotificacaoComoLida(notificacao);
    this.notificacaoAtiva = false;
    this.painelNotificacoesAberto = false;
    this.abrirCaso(notificacao.idProcesso);
  }

  fecharNotificacao(): void {
    if (this.notificacaoAtual) {
      this.marcarNotificacaoComoLida(this.notificacaoAtual);
    }
    this.notificacaoAtiva = false;
  }

  marcarTodasComoLidas(): void {
    this.notificacoes = this.notificacoes.map((notificacao) => ({
      ...notificacao,
      lida: true
    }));
    this.idsNotificacoesLidas = Array.from(
      new Set(this.notificacoes.map((notificacao) => notificacao.id))
    );
    localStorage.setItem('justapro-notif-lidas', JSON.stringify(this.idsNotificacoesLidas));
    this.notificacoesNaoLidas = 0;
    this.notificacoesAgrupadas = this.agruparNotificacoes(this.notificacoes);
    this.notificacaoAtiva = false;
  }

  tempoRelativo(timestamp: number): string {
    return tempoRelativo(timestamp);
  }

  formatarResumoPrazo(proc: ProcessoViewModel): string {
    return formatarResumoPrazo(proc);
  }

  statusBadgeClass(status: ProcessoStatusVisual): string {
    return obterMetaStatus(status).badgeClass;
  }

  statusIcon(status: ProcessoStatusVisual): string {
    return obterMetaStatus(status).icon;
  }

  statusTextClass(status: ProcessoStatusVisual): string {
    return obterMetaStatus(status).textClass;
  }

  categoriaLabel(tipo: CategoriaCompromisso): string {
    return categoriaCompromissoLabel(tipo);
  }

  compromissoIcon(tipo: CategoriaCompromisso): string {
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

  irParaProcessosUrgentes(): void {
    this.fecharResumoDiario();
    void this.router.navigate(['/advogado/processos']).then(() => this.aplicarFiltro('Urgente'));
  }

  irParaProcessosAtrasados(): void {
    this.fecharResumoDiario();
    void this.router.navigate(['/advogado/processos']).then(() => this.aplicarFiltro('Atrasado'));
  }

  irParaVencimentosDeHoje(): void {
    this.fecharResumoDiario();
    void this.router.navigate(['/advogado/processos']).then(() => {
      const hoje = new Date();
      this.filtroDataInicial = hoje;
      this.filtroDataFinal = hoje;
      this.executarFiltros(true);
    });
  }

  fecharResumoDiario(): void {
    localStorage.setItem('justapro-resumo-data', this.dataLocalIso());
    this.resumoDiario.visivel = false;
  }

  trackByProcesso(_: number, proc: ProcessoViewModel): string {
    return proc.id;
  }

  trackByNotificacao(_: number, notificacao: Notificacao): string {
    return notificacao.id;
  }

  sair(): void {
    void this.authService.logout();
  }

  private carregarDados(): void {
    this.authService.listarProcessos().subscribe({
      next: (dados) => {
        const lista = Array.isArray(dados) ? (dados as ProcessoApiModel[]) : [];
        this.listaDeProcessosRaw = lista.map((processo) => mapearProcessoParaTela(processo));
        this.processoEmAcaoId = null;
        this.processarDadosInteligentes();
      },
      error: () => {
        this.snack.open('Nao foi possivel carregar os processos agora.', 'Fechar', {
          duration: 3600,
          panelClass: ['snack-error']
        });
      }
    });
  }

  selecionarClienteExistente(clienteId: string | null): void {
    this.clienteSelecionadoId = clienteId;

    if (!clienteId) {
      this.clienteForm = this.criarClienteFormVazio();
      return;
    }

    const cliente = this.clientesDisponiveis.find((item) => item.id === clienteId);
    if (!cliente) {
      return;
    }

    this.clienteForm = {
      nome: cliente.nome || '',
      cpfCnpj: cliente.cpf || cliente.documentoSecundario || '',
      telefone: cliente.telefone || '',
      email: cliente.email || '',
      endereco: cliente.endereco || '',
      numero: cliente.numero || '',
      complemento: cliente.complemento || '',
      bairro: cliente.bairro || '',
      cidade: cliente.cidade || '',
      estado: cliente.estado || '',
      cep: cliente.cep || ''
    };
    this.buscaCliente = cliente.nome;
  }

  desvincularClienteSelecionado(): void {
    this.clienteSelecionadoId = null;
    this.buscaCliente = '';
  }

  continuarCadastroManualCliente(): void {
    this.clienteSelecionadoId = null;
    const termoAtual = this.buscaCliente.trim();
    if (!this.clienteForm.nome.trim() && termoAtual && !this.extrairDigitos(termoAtual)) {
      this.clienteForm.nome = termoAtual;
    }
    this.buscaCliente = '';
  }

  private carregarClientes(): void {
    this.carregandoClientes = true;
    this.authService.listarClientes().subscribe({
      next: (clientes) => {
        this.clientesDisponiveis = clientes;
        this.carregandoClientes = false;
      },
      error: () => {
        this.carregandoClientes = false;
      }
    });
  }

  private normalizarTextoBusca(valor: string): string {
    return (valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private extrairDigitos(valor: string): string {
    return (valor || '').replace(/\D/g, '');
  }

  private criarClienteFormVazio(): ProcessoClienteForm {
    return {
      nome: '',
      cpfCnpj: '',
      telefone: '',
      email: '',
      endereco: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: ''
    };
  }

  private processarDadosInteligentes(): void {
    this.countAtivos = 0;
    this.countConcluidos = 0;
    this.countUrgentes = 0;
    this.countAtrasados = 0;
    this.countHoje = 0;

    const notificacoesGeradas: Notificacao[] = [];

    for (const proc of this.listaDeProcessosRaw) {
      if (proc.statusDinamico === 'Conclu\u00EDdo') this.countConcluidos++;
      if (!['Arquivado', 'Cancelado', 'Indeferido', 'Conclu\u00EDdo'].includes(proc.statusDinamico)) {
        this.countAtivos++;
      }
      if (proc.statusDinamico === 'Urgente') this.countUrgentes++;
      if (proc.statusDinamico === 'Atrasado') this.countAtrasados++;
      if (proc.diasParaPrazo === 0 && !['Arquivado', 'Conclu\u00EDdo'].includes(proc.statusDinamico)) {
        this.countHoje++;
      }

      const notificacao = this.gerarNotificacao(proc);
      if (notificacao) {
        notificacoesGeradas.push(notificacao);
      }
    }

    this.notificacoes = notificacoesGeradas.sort(
      (primeiro, segundo) =>
        primeiro.prioridade - segundo.prioridade || segundo.timestamp - primeiro.timestamp
    );
    this.notificacoesAgrupadas = this.agruparNotificacoes(this.notificacoes);
    this.notificacoesNaoLidas = this.notificacoes.filter((notificacao) => !notificacao.lida).length;
    this.atualizarResumoDiario();

    this.agendaEventos = this.listaDeProcessosRaw
      .map((processo) => processarAgendaEvento(processo))
      .filter((evento): evento is AgendaEvento => !!evento)
      .sort((primeiro, segundo) => primeiro.data.localeCompare(segundo.data));

    this.processosPrioritarios = [...this.listaDeProcessosRaw]
      .filter(
        (processo) =>
          !['Arquivado', 'Cancelado', 'Indeferido', 'Conclu\u00EDdo'].includes(processo.statusDinamico)
      )
      .sort(compararProcessosPorPrioridade)
      .slice(0, 5);

    const naoLidas = this.notificacoes.filter((notificacao) => !notificacao.lida);
    if (naoLidas.length > 0 && !this.toastJaMostradoSessao) {
      this.notificacaoAtual = naoLidas[0] || null;
      this.notificacaoAtiva = !!this.notificacaoAtual;
      this.toastJaMostradoSessao = true;
    }

    this.executarFiltros(false);
  }

  private gerarNotificacao(proc: ProcessoViewModel): Notificacao | null {
    let texto = '';
    let detalhe = '';
    let status: ProcessoStatusVisual | null = null;

    if (proc.statusDinamico === 'Atrasado') {
      texto = `${proc.cliente} esta com prazo vencido`;
      detalhe = formatarResumoPrazo(proc);
      status = 'Atrasado';
    } else if (proc.statusDinamico === 'Urgente' || proc.diasParaPrazo === 0) {
      texto =
        proc.diasParaPrazo === 0
          ? `${proc.cliente} vence hoje`
          : `${proc.cliente} exige atencao imediata`;
      detalhe = formatarResumoPrazo(proc);
      status = 'Urgente';
    }

    if (!status) {
      return null;
    }

    const prioridade = status === 'Atrasado' ? 0 : 1;
    const cacheKey = `justapro-notif-${proc.id}-${status}`;
    const tsKey = `${cacheKey}-ts`;
    const timestampSalvo = localStorage.getItem(tsKey);
    const timestamp = timestampSalvo ? Number(timestampSalvo) : Date.now();

    if (!timestampSalvo) {
      localStorage.setItem(tsKey, String(timestamp));
      this.notificar(
        status === 'Atrasado' ? 'Processo atrasado' : 'Processo urgente',
        `${proc.cliente}: ${detalhe}`
      );
    }

    const id = `${proc.id}-${status}`;
    const meta = obterMetaStatus(status);

    return {
      id,
      idProcesso: proc.id,
      cliente: proc.cliente,
      texto,
      detalhe,
      icone: meta.icon,
      classe: meta.badgeClass,
      lida: this.idsNotificacoesLidas.includes(id),
      timestamp,
      prioridade,
      status
    };
  }

  private agruparNotificacoes(lista: Notificacao[]): GrupoNotificacao[] {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const inicioHoje = hoje.getTime();
    const inicioOntem = inicioHoje - 86400000;
    const inicio7Dias = inicioHoje - 7 * 86400000;

    const grupos: GrupoNotificacao[] = [
      { titulo: 'Hoje', itens: [] },
      { titulo: 'Ontem', itens: [] },
      { titulo: 'Ultimos 7 dias', itens: [] }
    ];

    for (const notificacao of lista) {
      if (notificacao.timestamp >= inicioHoje) {
        grupos[0]!.itens.push(notificacao);
      } else if (notificacao.timestamp >= inicioOntem) {
        grupos[1]!.itens.push(notificacao);
      } else if (notificacao.timestamp >= inicio7Dias) {
        grupos[2]!.itens.push(notificacao);
      }
    }

    return grupos.filter((grupo) => grupo.itens.length > 0);
  }

  private atualizarResumoDiario(): void {
    this.resumoDiario.atrasados = this.countAtrasados;
    this.resumoDiario.urgentes = this.countUrgentes;
    this.resumoDiario.hoje = this.countHoje;

    const partes: string[] = [];
    if (this.countAtrasados > 0) {
      partes.push(
        `${this.countAtrasados} processo${this.countAtrasados === 1 ? '' : 's'} atrasado${
          this.countAtrasados === 1 ? '' : 's'
        }`
      );
    }
    if (this.countUrgentes > 0) {
      partes.push(`${this.countUrgentes} urgente${this.countUrgentes === 1 ? '' : 's'}`);
    }
    if (this.countHoje > 0) {
      partes.push(`${this.countHoje} vencendo hoje`);
    }

    if (partes.length === 0) {
      this.resumoDiario.texto = 'Tudo sob controle hoje. Nenhum prazo critico aberto.';
      this.resumoDiario.visivel = false;
      return;
    }

    if (partes.length === 1) {
      this.resumoDiario.texto = `Voce possui ${partes[0]}.`;
    } else {
      const ultimo = partes.pop();
      this.resumoDiario.texto = `Voce possui ${partes.join(', ')} e ${ultimo}.`;
    }

    const resumoVistoEm = localStorage.getItem('justapro-resumo-data');
    this.resumoDiario.visivel = resumoVistoEm !== this.dataLocalIso();
  }

  private executarFiltros(resetPagina = false): void {
    this.listaDeProcessosFiltrada = this.listaDeProcessosRaw.filter((proc) => {
      const passaPill =
        this.filtroAtual === 'Todos'
          ? !['Arquivado', 'Cancelado', 'Indeferido'].includes(proc.statusDinamico)
          : proc.statusDinamico === this.filtroAtual;

      const passaNome =
        !this.filtroNomeCliente ||
        proc.cliente.toLowerCase().includes(this.filtroNomeCliente.trim().toLowerCase());

      const passaTipo =
        !this.filtroTipoAcao ||
        proc.tipo.toLowerCase().includes(this.filtroTipoAcao.trim().toLowerCase());

      const passaStatus =
        this.filtroStatusAvancado === 'Todos' || proc.statusDinamico === this.filtroStatusAvancado;

      const passaCategoria =
        this.filtroCategoriaCompromisso === 'Todos' ||
        proc.categoriaCompromisso === this.filtroCategoriaCompromisso;

      let passaData = true;
      if (this.filtroDataInicial || this.filtroDataFinal) {
        if (!proc.prazo) {
          passaData = false;
        } else {
          const dataProcesso = new Date(`${proc.prazo}T12:00:00`).getTime();
          const inicio = this.filtroDataInicial
            ? new Date(this.filtroDataInicial).setHours(0, 0, 0, 0)
            : Number.NEGATIVE_INFINITY;
          const fim = this.filtroDataFinal
            ? new Date(this.filtroDataFinal).setHours(23, 59, 59, 999)
            : Number.POSITIVE_INFINITY;
          passaData = dataProcesso >= inicio && dataProcesso <= fim;
        }
      }

      return passaPill && passaNome && passaTipo && passaStatus && passaCategoria && passaData;
    });

    this.totalResultados = this.listaDeProcessosFiltrada.length;

    if (resetPagina) {
      this.paginaAtualProcessos = 1;
    }

    this.normalizarPaginacaoProcessos();
  }

  private normalizarPaginacaoProcessos(): void {
    if (this.paginaAtualProcessos > this.totalPaginasProcessos) {
      this.paginaAtualProcessos = this.totalPaginasProcessos;
    }

    if (this.paginaAtualProcessos < 1) {
      this.paginaAtualProcessos = 1;
    }
  }

  private marcarNotificacaoComoLida(notificacao: Notificacao): void {
    if (notificacao.lida) {
      return;
    }

    notificacao.lida = true;
    this.idsNotificacoesLidas = Array.from(new Set([...this.idsNotificacoesLidas, notificacao.id]));
    localStorage.setItem('justapro-notif-lidas', JSON.stringify(this.idsNotificacoesLidas));
    this.notificacoesNaoLidas = this.notificacoes.filter((item) => !item.lida).length;
  }

  private iniciarInteligenciaNotificacoes(): void {
    const hoje = this.dataLocalIso();
    const dataSalva = localStorage.getItem('justapro-notif-data');

    if (dataSalva !== hoje) {
      localStorage.setItem('justapro-notif-data', hoje);
      localStorage.removeItem('justapro-notif-lidas');
      Object.keys(localStorage)
        .filter((key) => key.startsWith('justapro-notif-') && key.endsWith('-ts'))
        .forEach((key) => localStorage.removeItem(key));
      this.idsNotificacoesLidas = [];
      this.toastJaMostradoSessao = false;
      return;
    }

    const lidas = localStorage.getItem('justapro-notif-lidas');
    this.idsNotificacoesLidas = lidas ? (JSON.parse(lidas) as string[]) : [];
  }

  private async pedirPermissaoNotificacao(): Promise<void> {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  private notificar(titulo: string, mensagem: string): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    new Notification(titulo, { body: mensagem });
  }

  private formatarDataParaApi(data: Date): string {
    const local = new Date(data);
    const year = local.getFullYear();
    const month = `${local.getMonth() + 1}`.padStart(2, '0');
    const day = `${local.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private dataLocalIso(): string {
    return this.formatarDataParaApi(new Date());
  }

  podeAlternarUrgencia(proc: ProcessoViewModel): boolean {
    return !['Conclu\u00EDdo', 'Arquivado', 'Cancelado', 'Indeferido'].includes(proc.statusDinamico);
  }
}
