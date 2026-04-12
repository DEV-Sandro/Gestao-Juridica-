export type ProcessoStatusVisual =
  | 'Aguardando Análise'
  | 'Em Andamento'
  | 'Urgente'
  | 'Atrasado'
  | 'Concluído'
  | 'Arquivado'
  | 'Cancelado'
  | 'Indeferido';

export type CategoriaCompromisso = 'PRAZO' | 'AUDIENCIA' | 'EVENTO' | 'DOCUMENTO';
export type OrcamentoStatus =
  | 'RASCUNHO'
  | 'ENVIADO_CLIENTE'
  | 'AGUARDANDO_RESPOSTA_CLIENTE'
  | 'ACEITO'
  | 'RECUSADO'
  | 'CONVERTIDO_CONTRATO';

export interface ProcessoOrcamento {
  valor?: number | null;
  descricaoServico?: string | null;
  observacoes?: string | null;
  status?: OrcamentoStatus | string | null;
  estadoOab?: string | null;
  criadoEm?: string | null;
  atualizadoEm?: string | null;
  enviadoEm?: string | null;
  respostaClienteEm?: string | null;
  convertidoContratoEm?: string | null;
}

export interface ProcessoApiModel {
  id: string;
  titulo?: string | null;
  tipo?: string | null;
  descricao?: string | null;
  observacao?: string | null;
  cliente?: string | null;
  clienteNome?: string | null;
  clienteId?: string | null;
  status?: string | null;
  statusCalculado?: string | null;
  prazo?: string | null;
  urgenteManual?: boolean | null;
  categoriaCompromisso?: string | null;
  localCompromisso?: string | null;
  criadoEm?: string | null;
  atualizadoEm?: string | null;
  arquivado?: boolean | null;
  orcamento?: ProcessoOrcamento | null;
}

export interface ProcessoViewModel extends ProcessoApiModel {
  cliente: string;
  tipo: string;
  descricao: string;
  statusBase: ProcessoStatusVisual;
  statusDinamico: ProcessoStatusVisual;
  categoriaCompromisso: CategoriaCompromisso;
  categoriaCompromissoLabel: string;
  urgenteManual: boolean;
  diasParaPrazo: number | null;
}

export interface AgendaEvento {
  id: string;
  processoId: string;
  data: string;
  titulo: string;
  subtitulo: string;
  tipo: CategoriaCompromisso;
  tipoLabel: string;
  status: ProcessoStatusVisual;
  statusLabel: string;
  icon: string;
  detalhe: string;
  localCompromisso: string | null;
}

export interface HistoricoRegistroApi {
  id: string;
  acao?: string | null;
  criadoEm?: string | null;
  detalhes?: Record<string, unknown> | null;
  usuarioEmail?: string | null;
  usuarioNome?: string | null;
}

export interface TimelineItem {
  id: string;
  data: string;
  titulo: string;
  descricao: string;
  icone: string;
  tonalidade: 'info' | 'warning' | 'danger' | 'success' | 'neutral';
  autor?: string;
  conteudo?: string;
  etiqueta?: string;
}

export interface ThemeOption {
  value: 'light' | 'corporate' | 'dark';
  label: string;
  icon: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { value: 'light', label: 'Modo Claro', icon: 'light_mode' },
  { value: 'corporate', label: 'Azul Corporativo', icon: 'business' },
  { value: 'dark', label: 'Modo Escuro', icon: 'dark_mode' }
];

const STATUS_FINAIS = new Set<ProcessoStatusVisual>([
  'Concluído',
  'Arquivado',
  'Cancelado',
  'Indeferido'
]);

const STATUS_PRIORITY: Record<ProcessoStatusVisual, number> = {
  Atrasado: 0,
  Urgente: 1,
  'Em Andamento': 2,
  'Aguardando Análise': 3,
  Concluído: 4,
  Arquivado: 5,
  Cancelado: 6,
  Indeferido: 7
};

const CAMPOS_HISTORICO_LABEL: Record<string, string> = {
  titulo: 'Titulo do processo',
  descricao: 'Descricao',
  prazo: 'Prazo principal',
  status: 'Status',
  clienteNome: 'Cliente vinculado',
  categoriaCompromisso: 'Tipo de compromisso',
  localCompromisso: 'Local ou referencia',
  urgenteManual: 'Prioridade manual'
};

export function normalizarCategoriaCompromisso(
  valor?: string | null
): CategoriaCompromisso {
  const normalizado = valor?.trim().toUpperCase();

  if (normalizado === 'AUDIENCIA') return 'AUDIENCIA';
  if (normalizado === 'EVENTO') return 'EVENTO';
  if (normalizado === 'DOCUMENTO') return 'DOCUMENTO';
  return 'PRAZO';
}

export function categoriaCompromissoLabel(tipo: CategoriaCompromisso): string {
  switch (tipo) {
    case 'AUDIENCIA':
      return 'Audiência';
    case 'EVENTO':
      return 'Evento';
    case 'DOCUMENTO':
      return 'Documento';
    default:
      return 'Prazo';
  }
}

export function normalizarOrcamentoStatus(
  valor?: string | null
): OrcamentoStatus {
  switch ((valor || '').trim().toUpperCase()) {
    case 'ENVIADO_CLIENTE':
      return 'ENVIADO_CLIENTE';
    case 'AGUARDANDO_RESPOSTA_CLIENTE':
      return 'AGUARDANDO_RESPOSTA_CLIENTE';
    case 'ACEITO':
      return 'ACEITO';
    case 'RECUSADO':
      return 'RECUSADO';
    case 'CONVERTIDO_CONTRATO':
      return 'CONVERTIDO_CONTRATO';
    case 'RASCUNHO':
    default:
      return 'RASCUNHO';
  }
}

export function orcamentoStatusLabel(status: OrcamentoStatus): string {
  switch (status) {
    case 'ENVIADO_CLIENTE':
      return 'Enviado ao cliente';
    case 'AGUARDANDO_RESPOSTA_CLIENTE':
      return 'Aguardando resposta do cliente';
    case 'ACEITO':
      return 'Aceito';
    case 'RECUSADO':
      return 'Recusado';
    case 'CONVERTIDO_CONTRATO':
      return 'Convertido em contrato';
    case 'RASCUNHO':
    default:
      return 'Rascunho';
  }
}

export function obterMetaOrcamento(status: OrcamentoStatus): {
  icon: string;
  badgeClass: string;
  label: string;
} {
  switch (status) {
    case 'ACEITO':
      return {
        icon: 'task_alt',
        badgeClass: 'is-complete',
        label: 'Aceito'
      };
    case 'RECUSADO':
      return {
        icon: 'block',
        badgeClass: 'is-overdue',
        label: 'Recusado'
      };
    case 'CONVERTIDO_CONTRATO':
      return {
        icon: 'description',
        badgeClass: 'is-progress',
        label: 'Convertido em contrato'
      };
    case 'ENVIADO_CLIENTE':
      return {
        icon: 'forward_to_inbox',
        badgeClass: 'is-progress',
        label: 'Enviado ao cliente'
      };
    case 'AGUARDANDO_RESPOSTA_CLIENTE':
      return {
        icon: 'hourglass_top',
        badgeClass: 'is-urgent',
        label: 'Aguardando resposta do cliente'
      };
    case 'RASCUNHO':
    default:
      return {
        icon: 'edit_note',
        badgeClass: 'is-neutral',
        label: 'Rascunho'
      };
  }
}

export function formatarMoeda(valor?: number | null): string {
  if (typeof valor !== 'number' || Number.isNaN(valor)) {
    return '--';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

export function normalizarStatusVisual(
  valor?: string | null
): ProcessoStatusVisual {
  switch (valor) {
    case 'Aguardando Análise':
      return 'Aguardando Análise';
    case 'Urgente':
      return 'Urgente';
    case 'Atrasado':
      return 'Atrasado';
    case 'Concluído':
      return 'Concluído';
    case 'Arquivado':
      return 'Arquivado';
    case 'Cancelado':
      return 'Cancelado';
    case 'Indeferido':
      return 'Indeferido';
    case 'Em Andamento':
    default:
      return 'Em Andamento';
  }
}

export function diferencaDiasParaPrazo(prazo?: string | null): number | null {
  if (!prazo) return null;

  const data = new Date(`${prazo}T00:00:00`);
  if (Number.isNaN(data.getTime())) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  data.setHours(0, 0, 0, 0);

  return Math.ceil((data.getTime() - hoje.getTime()) / 86400000);
}

export function calcularStatusVisual(
  processo: Pick<ProcessoApiModel, 'status' | 'prazo' | 'urgenteManual' | 'arquivado'>
): ProcessoStatusVisual {
  const statusBase = normalizarStatusVisual(processo.status);

  if (['Cancelado', 'Indeferido', 'Arquivado'].includes(statusBase) || processo.arquivado === true) {
    return processo.arquivado ? 'Arquivado' : statusBase;
  }

  const diasParaPrazo = diferencaDiasParaPrazo(processo.prazo);
  const urgenteManual = processo.urgenteManual === true || statusBase === 'Urgente';

  if (statusBase === 'Concluído') {
    return 'Concluído';
  }

  if (urgenteManual) {
    return diasParaPrazo !== null && diasParaPrazo < 0 ? 'Atrasado' : 'Urgente';
  }

  if (diasParaPrazo !== null) {
    if (diasParaPrazo < 0) return 'Atrasado';
    if (diasParaPrazo <= 7) return 'Urgente';
  }

  return statusBase;
}

export function mapearProcessoParaTela(processo: ProcessoApiModel): ProcessoViewModel {
  const categoriaCompromisso = normalizarCategoriaCompromisso(processo.categoriaCompromisso);
  const statusBase = normalizarStatusVisual(processo.status);
  const urgenteManual = processo.urgenteManual === true || statusBase === 'Urgente';

  return {
    ...processo,
    cliente: processo.cliente || processo.clienteNome || processo.clienteId || 'Não informado',
    tipo: processo.tipo || processo.titulo || 'Sem tipo definido',
    descricao: processo.descricao || processo.observacao || '',
    statusBase,
    statusDinamico: calcularStatusVisual({ ...processo, urgenteManual }),
    categoriaCompromisso,
    categoriaCompromissoLabel: categoriaCompromissoLabel(categoriaCompromisso),
    urgenteManual,
    diasParaPrazo: diferencaDiasParaPrazo(processo.prazo)
  };
}

export function obterMetaStatus(status: ProcessoStatusVisual): {
  icon: string;
  badgeClass: string;
  textClass: string;
  label: string;
} {
  switch (status) {
    case 'Atrasado':
      return {
        icon: 'error',
        badgeClass: 'is-overdue',
        textClass: 'text-overdue',
        label: 'Atrasado'
      };
    case 'Urgente':
      return {
        icon: 'priority_high',
        badgeClass: 'is-urgent',
        textClass: 'text-urgent',
        label: 'Urgente'
      };
    case 'Concluído':
      return {
        icon: 'check_circle',
        badgeClass: 'is-complete',
        textClass: 'text-complete',
        label: 'Concluído'
      };
    case 'Aguardando Análise':
      return {
        icon: 'hourglass_top',
        badgeClass: 'is-progress',
        textClass: 'text-progress',
        label: 'Aguardando análise'
      };
    default:
      return {
        icon: 'schedule',
        badgeClass: 'is-progress',
        textClass: 'text-progress',
        label: status
      };
  }
}

export function formatarResumoPrazo(processo: ProcessoViewModel): string {
  if (!processo.prazo) return 'Sem prazo definido';

  if (processo.diasParaPrazo === null) return `Prazo em ${processo.prazo}`;
  if (processo.diasParaPrazo < 0) {
    const dias = Math.abs(processo.diasParaPrazo);
    return `Atrasado há ${dias} dia${dias === 1 ? '' : 's'}`;
  }
  if (processo.diasParaPrazo === 0) return 'Vence hoje';
  if (processo.diasParaPrazo === 1) return 'Vence amanhã';
  if (processo.diasParaPrazo <= 7) return `Vence em ${processo.diasParaPrazo} dias`;
  return `Prazo em ${formatarDataCurta(processo.prazo)}`;
}

export function formatarDataCurta(valor?: string | null): string {
  if (!valor) return '--';

  const data = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(data.getTime())) return '--';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(data);
}

export function processarAgendaEvento(processo: ProcessoViewModel): AgendaEvento | null {
  if (!processo.prazo || STATUS_FINAIS.has(processo.statusDinamico)) {
    return null;
  }

  const meta = obterMetaStatus(processo.statusDinamico);

  return {
    id: `${processo.id}-${processo.prazo}`,
    processoId: processo.id,
    data: processo.prazo,
    titulo: processo.tipo,
    subtitulo: processo.cliente,
    tipo: processo.categoriaCompromisso,
    tipoLabel: processo.categoriaCompromissoLabel,
    status: processo.statusDinamico,
    statusLabel: meta.label,
    icon: meta.icon,
    detalhe: formatarResumoPrazo(processo),
    localCompromisso: processo.localCompromisso || null
  };
}

export function compararProcessosPorPrioridade(
  primeiro: ProcessoViewModel,
  segundo: ProcessoViewModel
): number {
  const prioridadeStatus =
    STATUS_PRIORITY[primeiro.statusDinamico] - STATUS_PRIORITY[segundo.statusDinamico];

  if (prioridadeStatus !== 0) {
    return prioridadeStatus;
  }

  if (primeiro.diasParaPrazo === null) return 1;
  if (segundo.diasParaPrazo === null) return -1;
  return primeiro.diasParaPrazo - segundo.diasParaPrazo;
}

export function tempoRelativo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutos = Math.floor(diff / 60000);

  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;

  const dias = Math.floor(horas / 24);
  return `há ${dias}d`;
}

function obterAutorHistorico(log: HistoricoRegistroApi): string {
  return log.usuarioNome || log.usuarioEmail || 'Equipe JustaPro';
}

function formatarValorHistorico(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') {
    return 'nao informado';
  }

  if (campo === 'prazo' && typeof valor === 'string') {
    return formatarDataCurta(valor);
  }

  if (campo === 'categoriaCompromisso' && typeof valor === 'string') {
    return categoriaCompromissoLabel(normalizarCategoriaCompromisso(valor));
  }

  if (campo === 'urgenteManual') {
    return valor ? 'ativada' : 'desativada';
  }

  return String(valor);
}

function descreverMudancasHistorico(detalhes: Record<string, unknown>): string {
  const mudancas = Array.isArray(detalhes['mudancas'])
    ? (detalhes['mudancas'] as Array<Record<string, unknown>>)
    : [];

  if (mudancas.length > 0) {
    return mudancas
      .map((mudanca) => {
        const campo = String(mudanca['campo'] || '');
        const label = CAMPOS_HISTORICO_LABEL[campo] || campo || 'Campo';
        const de = formatarValorHistorico(campo, mudanca['de']);
        const para = formatarValorHistorico(campo, mudanca['para']);
        return `${label}: ${de} -> ${para}`;
      })
      .join('\n');
  }

  if (Array.isArray(detalhes['camposAtualizados']) && detalhes['camposAtualizados'].length > 0) {
    return (detalhes['camposAtualizados'] as string[])
      .map((campo) => CAMPOS_HISTORICO_LABEL[campo] || campo)
      .join(', ');
  }

  return 'Ajustes internos registrados no processo.';
}

export function mapearHistoricoParaTimeline(
  log: HistoricoRegistroApi
): TimelineItem {
  const acao = log.acao || 'ATUALIZAR';
  const detalhes = log.detalhes || {};
  const usuario = obterAutorHistorico(log);

  switch (acao) {
    case 'CRIAR':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Processo criado',
        descricao: `Cadastro inicial registrado por ${usuario}.`,
        icone: 'note_add',
        tonalidade: 'info',
        autor: usuario,
        conteudo:
          String(detalhes['titulo'] || '') ||
          String(detalhes['clienteNome'] || '') ||
          'Processo incluido na base ativa.',
        etiqueta: 'Criacao'
      };
    case 'CONCLUIR':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Processo concluído',
        descricao: 'O caso foi marcado como concluído e saiu da fila ativa.',
        icone: 'task_alt',
        tonalidade: 'success'
      };
    case 'ALTERAR_STATUS':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Status alterado',
        descricao: `De ${String(detalhes['statusAnterior'] || 'nao informado')} para ${String(detalhes['statusNovo'] || 'nao informado')}.`,
        icone: 'autorenew',
        tonalidade: 'warning',
        autor: usuario,
        etiqueta: 'Status'
      };
    case 'MARCAR_URGENTE':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Urgência manual ativada',
        descricao: 'A prioridade manual passou a sobrescrever a regra automática.',
        icone: 'priority_high',
        tonalidade: 'warning'
      };
    case 'REMOVER_URGENTE':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Urgência manual removida',
        descricao: 'O caso voltou a seguir a classificação automática por prazo.',
        icone: 'low_priority',
        tonalidade: 'neutral'
      };
    case 'CLIENTE_VINCULADO':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Cliente vinculado',
        descricao: `Cliente relacionado ao processo: ${String(detalhes['clienteNome'] || 'nao informado')}.`,
        icone: 'person_add_alt_1',
        tonalidade: 'info',
        autor: usuario,
        etiqueta: 'Cliente'
      };
    case 'CRIAR_ETAPA':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Nova etapa adicionada',
        descricao:
          typeof detalhes['resumo'] === 'string' && detalhes['resumo']
            ? String(detalhes['resumo'])
            : `${String(detalhes['titulo'] || 'Etapa')} programada para ${String(
                detalhes['dataLimite'] || '--'
              )}.`,
        icone: 'flag',
        tonalidade: 'info',
        autor: usuario,
        etiqueta: 'Etapa'
      };
    case 'CONCLUIR_ETAPA':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Etapa concluida',
        descricao: `${String(detalhes['titulo'] || 'Etapa')} foi concluida na execucao.`,
        icone: 'check_circle',
        tonalidade: 'success',
        autor: usuario,
        etiqueta: 'Etapa'
      };
    case 'REABRIR_ETAPA':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Etapa reaberta',
        descricao: `${String(detalhes['titulo'] || 'Etapa')} voltou para a fila pendente.`,
        icone: 'replay_circle_filled',
        tonalidade: 'warning',
        autor: usuario,
        etiqueta: 'Etapa'
      };
    case 'ATUALIZAR_ETAPA':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Etapa atualizada',
        descricao:
          typeof detalhes['resumo'] === 'string' && detalhes['resumo']
            ? String(detalhes['resumo'])
            : String(detalhes['status']) === 'CONCLUIDO'
              ? `${String(detalhes['titulo'] || 'Etapa')} foi concluida.`
              : `${String(detalhes['titulo'] || 'Etapa')} voltou para pendente.`,
        icone: String(detalhes['status']) === 'CONCLUIDO' ? 'check_circle' : 'flag',
        tonalidade: String(detalhes['status']) === 'CONCLUIDO' ? 'success' : 'warning',
        autor: usuario,
        etiqueta: 'Etapa'
      };
    case 'REMOVER_ETAPA':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Etapa removida',
        descricao:
          typeof detalhes['resumo'] === 'string' && detalhes['resumo']
            ? String(detalhes['resumo'])
            : `${String(detalhes['titulo'] || 'Etapa')} foi removida da linha de execucao.`,
        icone: 'delete_outline',
        tonalidade: 'danger',
        autor: usuario,
        etiqueta: 'Etapa'
      };
    case 'ADICIONAR_OBSERVACAO':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Nova observacao registrada',
        descricao:
          String(detalhes['rotulo'] || '') ||
          `Observacao adicionada por ${String(detalhes['autor'] || usuario)}.`,
        icone: 'sticky_note_2',
        tonalidade: 'info',
        autor: String(detalhes['autor'] || usuario),
        etiqueta: 'Observacao'
      };
    case 'CRIAR_ORCAMENTO':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Orcamento criado',
        descricao:
          typeof detalhes['resumo'] === 'string' && detalhes['resumo']
            ? String(detalhes['resumo'])
            : 'Primeira versao do orcamento registrada neste processo.',
        icone: 'request_quote',
        tonalidade: 'info',
        autor: usuario,
        etiqueta: 'Orcamento'
      };
    case 'ATUALIZAR_ORCAMENTO':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Orcamento atualizado',
        descricao:
          typeof detalhes['resumo'] === 'string' && detalhes['resumo']
            ? String(detalhes['resumo'])
            : 'Ajustes no escopo ou no valor do orcamento.',
        icone: 'edit_note',
        tonalidade: 'neutral',
        autor: usuario,
        etiqueta: 'Orcamento'
      };
    case 'ALTERAR_STATUS_ORCAMENTO':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Status do orcamento atualizado',
        descricao: `De ${String(detalhes['statusAnterior'] || 'nao informado')} para ${String(
          detalhes['statusNovo'] || 'nao informado'
        )}.`,
        icone: 'sync_alt',
        tonalidade: 'warning',
        autor: usuario,
        etiqueta: 'Orcamento'
      };
    case 'CONVERTER_ORCAMENTO_CONTRATO':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Orcamento convertido em contrato',
        descricao: `Os dados aprovados alimentaram o contrato ${String(
          detalhes['templateNome'] || 'de honorarios'
        )}.`,
        icone: 'description',
        tonalidade: 'success',
        autor: usuario,
        etiqueta: 'Contrato'
      };
    case 'DOCUMENTO_GERADO':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Documento gerado',
        descricao: `Documento emitido a partir do template ${String(detalhes['templateNome'] || 'juridico')}.`,
        icone: 'description',
        tonalidade: 'success',
        autor: usuario,
        etiqueta: 'Documento'
      };
    case 'DELETAR_SOFT':
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Processo removido',
        descricao: 'O caso foi arquivado logicamente e saiu da visualização principal.',
        icone: 'delete_outline',
        tonalidade: 'danger'
      };
    default:
      return {
        id: log.id,
        data: log.criadoEm || new Date().toISOString(),
        titulo: 'Processo atualizado',
        descricao:
          typeof detalhes['resumo'] === 'string' && detalhes['resumo']
            ? String(detalhes['resumo'])
            :
          Array.isArray(detalhes['camposAtualizados']) && detalhes['camposAtualizados'].length > 0
            ? `Campos atualizados por ${usuario}: ${String(
                (detalhes['camposAtualizados'] as string[]).join(', ')
              )}.`
            : `Ajustes registrados por ${usuario}.`,
        icone: 'edit_note',
        tonalidade: 'neutral',
        autor: usuario,
        etiqueta: 'Atualizacao'
      };
  }
}



