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

import { CompromissoApiModel, CompromissoTipo } from '../../shared/processo-ui';

export interface CompromissoDialogData {
  compromisso?: CompromissoApiModel | null;
  processos: { id: string; titulo: string }[];
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
  readonly editando: boolean;
  readonly processos: { id: string; titulo: string }[];

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

  salvando = false;
  erro: string | null = null;

  constructor(
    private ref: MatDialogRef<CompromissoFormDialogComponent, CompromissoDialogResult>,
    @Inject(MAT_DIALOG_DATA) public dialogData: CompromissoDialogData
  ) {
    this.processos = dialogData.processos || [];
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
    return data.toISOString().slice(0, 10);
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

    const payload: Partial<CompromissoApiModel> = {
      titulo: this.titulo.trim(),
      tipo: this.tipo,
      dataInicio,
      dataFim,
      diaTodo: this.diaTodo,
      local: this.local.trim() || null,
      observacao: this.observacao.trim() || null,
      processoId: this.processoId || null,
      visibilidade: this.visibilidade
    };

    this.ref.close({ acao: 'salvar', payload });
  }

  excluir(): void {
    this.ref.close({ acao: 'excluir' });
  }
}
