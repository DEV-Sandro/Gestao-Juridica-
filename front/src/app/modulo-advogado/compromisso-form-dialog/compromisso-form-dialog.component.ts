import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import {
  CanalLembrete,
  CompromissoApiModel,
  CompromissoTipo,
  FrequenciaRecorrencia,
  LembreteCompromisso,
  RecorrenciaCompromisso
} from '../../shared/processo-ui';

export interface CompromissoDialogData {
  compromisso?: CompromissoApiModel | null;
  processos: { id: string; titulo: string }[];
  membros?: { uid: string; nome: string; cargo?: string | null }[];
  dataPreSelecionada?: string | null;
}

export interface CompromissoDialogResult {
  acao: 'salvar' | 'excluir';
  payload?: Partial<CompromissoApiModel>;
}

const TIPOS: { value: CompromissoTipo; label: string }[] = [
  { value: 'AUDIENCIA', label: 'Audiência' },
  { value: 'REUNIAO', label: 'Reunião' },
  { value: 'PRAZO', label: 'Prazo' },
  { value: 'EVENTO', label: 'Evento' },
  { value: 'OUTRO', label: 'Outro' }
];

const RECORRENCIAS: { value: FrequenciaRecorrencia; label: string }[] = [
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'QUINZENAL', label: 'A cada 15 dias' },
  { value: 'MENSAL', label: 'Mensal' }
];

const ANTECEDENCIAS: { value: number; label: string }[] = [
  { value: 15, label: '15 minutos antes' },
  { value: 60, label: '1 hora antes' },
  { value: 180, label: '3 horas antes' },
  { value: 1440, label: '1 dia antes' },
  { value: 2880, label: '2 dias antes' }
];

@Component({
  selector: 'app-compromisso-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule
  ],
  templateUrl: './compromisso-form-dialog.component.html',
  styleUrls: ['./compromisso-form-dialog.component.scss']
})
export class CompromissoFormDialogComponent {
  readonly tipos = TIPOS;
  readonly recorrencias = RECORRENCIAS;
  readonly antecedencias = ANTECEDENCIAS;
  readonly editando: boolean;
  readonly processos: { id: string; titulo: string }[];
  readonly membros: { uid: string; nome: string; cargo?: string | null }[];

  titulo = '';
  tipo: CompromissoTipo = 'REUNIAO';
  data = '';
  horaInicio = '09:00';
  horaFim = '10:00';
  diaTodo = false;
  local = '';
  observacao = '';
  processoId = '';
  visibilidade: 'PUBLICO' | 'RESTRITO' = 'PUBLICO';
  participantesIds: string[] = [];
  frequenciaRecorrencia: FrequenciaRecorrencia | '' = '';
  recorrenciaTotal = 4;
  recorrenciaAte = '';
  lembreteEmail = false;
  lembreteWhatsApp = false;
  lembreteAntecedencia = 60;

  salvando = false;
  erro: string | null = null;

  constructor(
    private ref: MatDialogRef<CompromissoFormDialogComponent, CompromissoDialogResult>,
    @Inject(MAT_DIALOG_DATA) public dialogData: CompromissoDialogData
  ) {
    this.processos = dialogData.processos || [];
    this.membros = dialogData.membros || [];
    this.editando = !!dialogData.compromisso;

    if (dialogData.compromisso) {
      const c = dialogData.compromisso;
      this.titulo = c.titulo;
      this.tipo = c.tipo;
      this.diaTodo = c.diaTodo;
      this.local = c.local || '';
      this.observacao = c.observacao || '';
      this.processoId = c.processoId || '';
      this.visibilidade = c.visibilidade || 'PUBLICO';
      this.participantesIds = [...(c.participantesIds || [])];
      this.preencherLembretes(c.lembretes || []);

      const inicio = new Date(c.dataInicio);
      const fim = new Date(c.dataFim);
      this.data = this.paraDataInput(inicio);
      this.horaInicio = this.paraHoraInput(inicio);
      this.horaFim = this.paraHoraInput(fim);
    } else {
      this.data = dialogData.dataPreSelecionada || this.paraDataInput(new Date());
    }
  }

  private paraDataInput(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  private paraHoraInput(data: Date): string {
    return data.toTimeString().slice(0, 5);
  }

  fechar(): void {
    if (!this.salvando) this.ref.close();
  }

  salvar(): void {
    this.erro = null;

    if (!this.titulo.trim()) {
      this.erro = 'Informe o título do compromisso.';
      return;
    }

    if (!this.data) {
      this.erro = 'Informe a data.';
      return;
    }

    const dataInicio = this.diaTodo
      ? `${this.data}T00:00:00`
      : `${this.data}T${this.horaInicio}:00`;
    const dataFim = this.diaTodo ? `${this.data}T23:59:59` : `${this.data}T${this.horaFim}:00`;

    if (new Date(dataFim).getTime() < new Date(dataInicio).getTime()) {
      this.erro = 'O horário final não pode ser antes do horário inicial.';
      return;
    }

    const lembretes = this.montarLembretes();
    const recorrencia = this.montarRecorrencia();

    const payload: Partial<CompromissoApiModel> = {
      titulo: this.titulo.trim(),
      tipo: this.tipo,
      dataInicio,
      dataFim,
      diaTodo: this.diaTodo,
      local: this.local.trim() || null,
      observacao: this.observacao.trim() || null,
      processoId: this.processoId || null,
      visibilidade: this.visibilidade,
      participantesIds: this.participantesIds,
      lembretes,
      ...(recorrencia ? { recorrencia } : {})
    };

    this.ref.close({ acao: 'salvar', payload });
  }

  excluir(): void {
    this.ref.close({ acao: 'excluir' });
  }

  private preencherLembretes(lembretes: LembreteCompromisso[]): void {
    const email = lembretes.find((lembrete) => lembrete.canal === 'EMAIL');
    const whatsapp = lembretes.find((lembrete) => lembrete.canal === 'WHATSAPP');
    this.lembreteEmail = !!email;
    this.lembreteWhatsApp = !!whatsapp;
    this.lembreteAntecedencia = email?.minutosAntes || whatsapp?.minutosAntes || 60;
  }

  private montarLembretes(): LembreteCompromisso[] {
    const canais: CanalLembrete[] = [];
    if (this.lembreteEmail) canais.push('EMAIL');
    if (this.lembreteWhatsApp) canais.push('WHATSAPP');
    return canais.map((canal) => ({ canal, minutosAntes: this.lembreteAntecedencia }));
  }

  private montarRecorrencia(): RecorrenciaCompromisso | null {
    if (this.editando || !this.frequenciaRecorrencia) return null;
    return {
      frequencia: this.frequenciaRecorrencia,
      total: Math.min(Math.max(Number(this.recorrenciaTotal) || 4, 2), 52),
      ate: this.recorrenciaAte || null
    };
  }

  exportarParaCalendario(): void {
    const compromisso = this.dialogData.compromisso;
    if (!compromisso) return;

    const inicio = new Date(compromisso.dataInicio);
    const fim = new Date(compromisso.dataFim);
    const linhas = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//JustaPro//Agenda//PT-BR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${compromisso.id}@justapro.app`,
      `DTSTAMP:${this.paraDataIcs(new Date())}`,
      compromisso.diaTodo
        ? `DTSTART;VALUE=DATE:${this.paraDiaIcs(inicio)}`
        : `DTSTART:${this.paraDataIcs(inicio)}`,
      compromisso.diaTodo
        ? `DTEND;VALUE=DATE:${this.paraDiaIcs(new Date(fim.getTime() + 86400000))}`
        : `DTEND:${this.paraDataIcs(fim)}`,
      `SUMMARY:${this.escaparIcs(compromisso.titulo)}`,
      ...(compromisso.local ? [`LOCATION:${this.escaparIcs(compromisso.local)}`] : []),
      ...(compromisso.observacao ? [`DESCRIPTION:${this.escaparIcs(compromisso.observacao)}`] : []),
      'END:VEVENT',
      'END:VCALENDAR',
      ''
    ];

    const arquivo = new Blob([linhas.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.nomeArquivoSeguro(compromisso.titulo)}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  private paraDataIcs(data: Date): string {
    return data.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  private paraDiaIcs(data: Date): string {
    return `${data.getFullYear()}${String(data.getMonth() + 1).padStart(2, '0')}${String(data.getDate()).padStart(2, '0')}`;
  }

  private escaparIcs(valor: string): string {
    return valor.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }

  private nomeArquivoSeguro(valor: string): string {
    return valor.trim().toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'compromisso-justapro';
  }
}
