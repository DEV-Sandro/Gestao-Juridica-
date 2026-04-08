import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { AuthService } from '../auth.service';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatDatepickerModule, MatDatepicker } from '@angular/material/datepicker';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, NativeDateModule } from '@angular/material/core';


export const MEU_FORMATO_BR = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'DD/MM/YYYY',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

interface Notificacao {
  id: string;
  idProcesso: string;
  cliente: string;
  texto: string;
  icone: string;
  corCss: string;
  lida: boolean;
}

@Component({
  selector: 'app-modulo-advogado',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatMenuModule,
    MatDatepickerModule,
    NativeDateModule
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
    { provide: MAT_DATE_FORMATS, useValue: MEU_FORMATO_BR }
  ],
  templateUrl: './modulo-advogado.html',
  styleUrls: ['./modulo-advogado.scss']
})
export class ModuloAdvogadoComponent implements OnInit, OnDestroy {
  listaDeProcessosRaw: any[] = [];
  listaDeProcessosFiltrada: any[] = [];

  mostrarFiltroAvancado = false;
  filtroAtual: string = 'Todos';
  filtroNomeCliente = '';
  filtroTipoAcao = '';
  filtroStatusAvancado = 'Todos';
  filtroDataInicial: Date | null = null;
  filtroDataFinal: Date | null = null;

  countAtivos = 0;
  countConcluidos = 0;
  countUrgentes = 0;
  countAtrasados = 0;

  notificacoes: Notificacao[] = [];
  notificacoesNaoLidas = 0;
  notificacaoAtual: Notificacao | null = null;
  notificacaoAtiva = false;
  toastJaMostradoSessao = false;
  idsNotificacoesLidas: string[] = [];

  mostrarFormulario = false;
  novoCliente = '';
  novoTipo = '';
  novaObservacao = '';
  novoPrazo: Date | null = null;
  novoStatus = 'Aguardando Análise';
  idEmEdicao: string | null = null;

  totalResultados = 0;

  private filtroSubject = new Subject<void>();
  private filtroSub?: Subscription;

  constructor(private authService: AuthService, private router: Router) {}

  
  ngOnInit() {
    const temaSalvo = localStorage.getItem('justapro-theme') || 'corporate';
    this.mudarTema(temaSalvo);
    this.iniciarInteligenciaNotificacoes();
    this.pedirPermissaoNotificacao();

    this.filtroSub = this.filtroSubject
      .pipe(debounceTime(300))
      .subscribe(() => this.executarFiltros());

    this.carregarDados();
  }

  ngOnDestroy() {
    this.filtroSub?.unsubscribe();
  }

  mudarTema(tema: string) {
    document.body.setAttribute('data-theme', tema);
    localStorage.setItem('justapro-theme', tema);
  }

  iniciarInteligenciaNotificacoes() {
    const hojeStr = new Date().toISOString().split('T')[0];
    const dataSalva = localStorage.getItem('justapro-notif-data');

    if (dataSalva !== hojeStr) {
      localStorage.setItem('justapro-notif-data', hojeStr);
      localStorage.removeItem('justapro-notif-lidas');
      this.idsNotificacoesLidas = [];
    } else {
      const lidasCache = localStorage.getItem('justapro-notif-lidas');
      if (lidasCache) this.idsNotificacoesLidas = JSON.parse(lidasCache);
    }
  }

  mapearProcessoParaTela(proc: any) {
    return {
      ...proc,
      cliente: proc.cliente || proc.clienteNome || proc.clienteId || 'Não informado',
      tipo: proc.tipo || proc.titulo || 'Sem tipo',
      observacao: proc.observacao || proc.descricao || '',
      status: proc.statusCalculado || proc.status || 'Em Andamento',
      statusDinamico: proc.statusCalculado || proc.status || 'Em Andamento'
    };
  }

  carregarDados() {
    this.authService.listarProcessos().subscribe({
      next: (dados: any) => {
        const lista = Array.isArray(dados) ? dados : [];
        this.listaDeProcessosRaw = lista.map((proc: any) => this.mapearProcessoParaTela(proc));
        this.processarDadosInteligentes();
      },
      error: (e: any) => console.error(e)
    });
  }

  processarDadosInteligentes() {
    this.countAtivos = 0;
    this.countConcluidos = 0;
    this.countUrgentes = 0;
    this.countAtrasados = 0;
    this.notificacoes = [];

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    this.listaDeProcessosRaw.forEach(proc => {
      let diferencaDias: number | null = null;

      if (proc.prazo) {
        const dataPrazo = new Date(proc.prazo + 'T00:00:00');
        diferencaDias = Math.ceil((dataPrazo.getTime() - hoje.getTime()) / (1000 * 3600 * 24));
      }

      if (proc.statusCalculado) {
        proc.statusDinamico = proc.statusCalculado;
      } else if (proc.status === 'Concluído') {
        proc.statusDinamico = (diferencaDias !== null && diferencaDias <= -30) ? 'Arquivado' : 'Concluído';
      } else if (['Cancelado', 'Indeferido'].includes(proc.status) || proc.arquivado) {
        proc.statusDinamico = proc.arquivado ? 'Arquivado' : proc.status;
      } else {
        if (proc.status === 'Urgente') {
          proc.statusDinamico = (diferencaDias !== null && diferencaDias < 0) ? 'Atrasado' : 'Urgente';
        } else if (diferencaDias !== null) {
          if (diferencaDias < 0) proc.statusDinamico = 'Atrasado';
          else if (diferencaDias <= 7) proc.statusDinamico = 'Urgente';
          else proc.statusDinamico = proc.status || 'Em Andamento';
        } else {
          proc.statusDinamico = proc.status || 'Em Andamento';
        }
      }

      if (proc.statusDinamico === 'Concluído') this.countConcluidos++;
      if (!['Arquivado', 'Cancelado', 'Indeferido', 'Concluído'].includes(proc.statusDinamico)) this.countAtivos++;
      if (proc.statusDinamico === 'Urgente') this.countUrgentes++;
      if (proc.statusDinamico === 'Atrasado') this.countAtrasados++;

      let notifId = '';
      let textoAviso = '';
      let icone = '';
      let cor = '';
      let gerarAlerta = false;

if (proc.statusDinamico === 'Atrasado') {
  const chave = 'notif-atrasado-' + proc.id;

  if (!localStorage.getItem(chave)) {
    this.notificar('Processo atrasado', proc.cliente);
    localStorage.setItem(chave, '1');
  }

  notifId = `atr-${proc.id}`;
  textoAviso = 'Processo Atrasado';
  icone = 'error';
  cor = 'text-danger';
  gerarAlerta = true;

} else if (proc.statusDinamico === 'Urgente' || (diferencaDias !== null && diferencaDias <= 3)) {
  const chave = 'notif-urgente-' + proc.id;

  if (!localStorage.getItem(chave)) {
    this.notificar('Processo urgente', proc.cliente);
    localStorage.setItem(chave, '1');
  }

  notifId = `urg-${proc.id}`;
  icone = 'notification_important';
  cor = 'text-warning';
  gerarAlerta = true;

  if (diferencaDias === 0) textoAviso = 'Prazo vence HOJE';
  else if (diferencaDias !== null && diferencaDias > 0 && diferencaDias <= 3) textoAviso = `Vence em ${diferencaDias} dias`;
  else textoAviso = 'Processo Urgente';
}

if (gerarAlerta) {
  const jaFoiLida = this.idsNotificacoesLidas.includes(notifId);

  this.notificacoes.push({
    id: notifId,
    idProcesso: proc.id,
    cliente: proc.cliente,
    texto: textoAviso,
    icone,
    corCss: cor,
    lida: jaFoiLida
  });
}
});

const naoLidas = this.notificacoes.filter(n => !n.lida);
this.notificacoesNaoLidas = naoLidas.length;

if (naoLidas.length > 0 && !this.toastJaMostradoSessao) {
  this.notificacaoAtual = naoLidas[0];
  this.notificacaoAtiva = true;
  this.toastJaMostradoSessao = true;
}

    this.executarFiltros();
  }

  marcarTodasComoLidas() {
    this.notificacoes.forEach(n => {
      if (!n.lida) {
        n.lida = true;
        if (!this.idsNotificacoesLidas.includes(n.id)) this.idsNotificacoesLidas.push(n.id);
      }
    });

    localStorage.setItem('justapro-notif-lidas', JSON.stringify(this.idsNotificacoesLidas));
    this.notificacoesNaoLidas = 0;
    this.fecharNotificacao();
  }

  limparNotificacoes() {
    this.marcarTodasComoLidas();
    this.notificacoes = [];
  }

  marcarNotificacaoComoLida(notif: Notificacao) {
    if (!notif.lida) {
      notif.lida = true;
      this.idsNotificacoesLidas.push(notif.id);
      localStorage.setItem('justapro-notif-lidas', JSON.stringify(this.idsNotificacoesLidas));
      this.notificacoesNaoLidas = this.notificacoes.filter(n => !n.lida).length;
    }
  }

    
  fecharNotificacao() {
    if (this.notificacaoAtual) this.marcarNotificacaoComoLida(this.notificacaoAtual);
    this.notificacaoAtiva = false;
  }

  abrirNotificacao(notif: Notificacao) {
    this.marcarNotificacaoComoLida(notif);
    this.notificacaoAtiva = false;
    this.abrirCaso(notif.idProcesso);
  }

  toggleFiltroAvancado() {
    this.mostrarFiltroAvancado = !this.mostrarFiltroAvancado;
  }

  scheduleFiltro() {
    this.filtroSubject.next();
  }

  limparFiltrosAvancados() {
    this.filtroNomeCliente = '';
    this.filtroTipoAcao = '';
    this.filtroDataInicial = null;
    this.filtroDataFinal = null;
    this.filtroStatusAvancado = 'Todos';
    this.filtroAtual = 'Todos';
    this.executarFiltros();
  }

  aplicarFiltro(status: string) {
    this.filtroAtual = status;
    this.executarFiltros();
  }

  get filtrosAtivosCount(): number {
    let total = 0;
    if (this.filtroNomeCliente.trim()) total++;
    if (this.filtroTipoAcao.trim()) total++;
    if (this.filtroStatusAvancado !== 'Todos') total++;
    if (this.filtroDataInicial) total++;
    if (this.filtroDataFinal) total++;
    if (this.filtroAtual !== 'Todos') total++;
    return total;
  }

  get temFiltrosAtivos(): boolean {
    return this.filtrosAtivosCount > 0;
  }

  executarFiltros() {
    this.listaDeProcessosFiltrada = this.listaDeProcessosRaw.filter(proc => {
      const passaPill =
        this.filtroAtual === 'Todos'
          ? !['Arquivado', 'Cancelado', 'Indeferido'].includes(proc.statusDinamico)
          : proc.statusDinamico === this.filtroAtual;

      const passaNome =
        !this.filtroNomeCliente ||
        (proc.cliente && proc.cliente.toLowerCase().includes(this.filtroNomeCliente.toLowerCase()));

      const passaTipo =
        !this.filtroTipoAcao ||
        (proc.tipo && proc.tipo.toLowerCase().includes(this.filtroTipoAcao.toLowerCase()));

      const passaStatusAdv =
        this.filtroStatusAvancado === 'Todos'
          ? true
          : proc.statusDinamico === this.filtroStatusAvancado;

      let passaData = true;

      if (this.filtroDataInicial || this.filtroDataFinal) {
        const dataProc = proc.prazo ? new Date(proc.prazo + 'T00:00:00').getTime() : null;

        if (!dataProc) {
          passaData = false;
        } else {
          const inicio = this.filtroDataInicial ? new Date(this.filtroDataInicial).setHours(0, 0, 0, 0) : 0;
          const fim = this.filtroDataFinal ? new Date(this.filtroDataFinal).setHours(23, 59, 59, 999) : Infinity;
          passaData = dataProc >= inicio && dataProc <= fim;
        }
      }

      return passaPill && passaNome && passaTipo && passaStatusAdv && passaData;
    });

    this.totalResultados = this.listaDeProcessosFiltrada.length;
  }

  escolherAno(normalizedYear: Date, datepicker: MatDatepicker<Date>) {
    const ctrlValue = this.novoPrazo ? new Date(this.novoPrazo) : new Date();
    ctrlValue.setFullYear(normalizedYear.getFullYear());
    this.novoPrazo = ctrlValue;
    datepicker.close();
  }

  escolherMes(normalizedMonth: Date, datepicker: MatDatepicker<Date>, baseDate?: Date | null) {
    const ctrlValue = baseDate ? new Date(baseDate) : (this.novoPrazo ? new Date(this.novoPrazo) : new Date());
    ctrlValue.setMonth(normalizedMonth.getMonth());
    this.novoPrazo = ctrlValue;
    datepicker.close();
  }

  abrirNovoProcesso() {
    this.cancelarEdicao();
    this.mostrarFormulario = true;
  }

  fecharFormulario() {
    this.mostrarFormulario = false;
    this.cancelarEdicao();
  }

  abrirCaso(id: string) {
    this.router.navigate(['/processo', id]);
  }

  salvar() {
    if (!this.novoCliente || !this.novoTipo) {
      return alert('Preencha Cliente e Tipo da Ação!');
    }

    const dados = {
      titulo: this.novoTipo,
      descricao: this.novaObservacao,
      clienteId: this.novoCliente,
      prazo: this.novoPrazo ? this.novoPrazo.toISOString().split('T')[0] : null,
      status: this.novoStatus
    };

    if (this.idEmEdicao) {
      this.authService.atualizarProcesso(this.idEmEdicao, dados).subscribe({
        next: () => {
          this.fecharFormulario();
          this.carregarDados();
        },
        error: (e: any) => console.error(e)
      });
    } else {
      this.authService.salvarProcesso(dados).subscribe({
        next: () => {
          this.fecharFormulario();
          this.carregarDados();
        },
        error: (e: any) => console.error(e)
      });
    }
  }

  prepararEdicao(proc: any) {
    this.idEmEdicao = proc.id;
    this.novoCliente = proc.cliente || proc.clienteId || '';
    this.novoTipo = proc.tipo || proc.titulo || '';
    this.novaObservacao = proc.observacao || proc.descricao || '';
    this.novoPrazo = proc.prazo ? new Date(proc.prazo + 'T00:00:00') : null;
    this.novoStatus = proc.status || 'Aguardando Análise';
    this.mostrarFormulario = true;
  }

  cancelarEdicao() {
    this.idEmEdicao = null;
    this.novoCliente = '';
    this.novoTipo = '';
    this.novaObservacao = '';
    this.novoPrazo = null;
    this.novoStatus = 'Aguardando Análise';
  }

  deletar(id: string) {
    if (confirm('Excluir permanentemente?')) {
      this.authService.excluirProcesso(id).subscribe({
        next: () => this.carregarDados(),
        error: (e: any) => console.error(e)
      });
    }
  }

  sair() {
    this.authService.logout();
  }

  async pedirPermissaoNotificacao() {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}
notificar(titulo: string, mensagem: string) {
  if (Notification.permission === 'granted') {
    new Notification(titulo, {
      body: mensagem
    });
  }
}


}