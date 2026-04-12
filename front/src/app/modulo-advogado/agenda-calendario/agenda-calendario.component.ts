import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AgendaEvento, ProcessoStatusVisual } from '../../shared/processo-ui';

interface CalendarDay {
  iso: string;
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasUrgent: boolean;
  hasOverdue: boolean;
  events: AgendaEvento[];
}

@Component({
  selector: 'app-agenda-calendario',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './agenda-calendario.component.html',
  styleUrls: ['./agenda-calendario.component.scss']
})
export class AgendaCalendarioComponent implements OnChanges {
  @Input() eventos: AgendaEvento[] = [];
  @Output() abrirEvento = new EventEmitter<AgendaEvento>();

  readonly weekdayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

  visibleMonth = this.startOfMonth(new Date());
  selectedDateIso = this.toIsoDate(new Date());

  days: CalendarDay[] = [];
  eventosSelecionados: AgendaEvento[] = [];

  ngOnChanges(_: SimpleChanges): void {
    if (!this.existeData(this.selectedDateIso) && this.eventos.length > 0) {
      this.selectedDateIso = this.eventos[0]!.data;
      this.visibleMonth = this.startOfMonth(this.parseIsoDate(this.selectedDateIso));
    }

    this.rebuildCalendar();
  }

  get monthLabel(): string {
    const label = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric'
    }).format(this.visibleMonth);

    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  get totalEventosNoMes(): number {
    return this.eventosDoMes.length;
  }

  get totalUrgentesNoMes(): number {
    return this.eventosDoMes.filter((evento) => evento.status === 'Urgente').length;
  }

  get totalAtrasadosNoMes(): number {
    return this.eventosDoMes.filter((evento) => evento.status === 'Atrasado').length;
  }

  irParaHoje(): void {
    this.visibleMonth = this.startOfMonth(new Date());
    this.selectedDateIso = this.toIsoDate(new Date());
    this.rebuildCalendar();
  }

  irParaMesAnterior(): void {
    const anterior = new Date(this.visibleMonth);
    anterior.setMonth(anterior.getMonth() - 1);
    this.visibleMonth = this.startOfMonth(anterior);
    this.rebuildCalendar();
  }

  irParaMesSeguinte(): void {
    const proximo = new Date(this.visibleMonth);
    proximo.setMonth(proximo.getMonth() + 1);
    this.visibleMonth = this.startOfMonth(proximo);
    this.rebuildCalendar();
  }

  selecionarDia(day: CalendarDay): void {
    this.selectedDateIso = day.iso;

    if (!day.inCurrentMonth) {
      this.visibleMonth = this.startOfMonth(day.date);
    }

    this.rebuildCalendar();
  }

  selecionarEvento(evento: AgendaEvento, domEvent?: Event): void {
    domEvent?.stopPropagation();
    this.selectedDateIso = evento.data;
    this.visibleMonth = this.startOfMonth(this.parseIsoDate(evento.data));
    this.rebuildCalendar();
    this.abrirEvento.emit(evento);
  }

  formatarCabecalhoDia(): string {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    }).format(this.parseIsoDate(this.selectedDateIso));
  }

  statusClass(status: ProcessoStatusVisual): string {
    switch (status) {
      case 'Atrasado':
        return 'is-overdue';
      case 'Urgente':
        return 'is-urgent';
      case 'Concluído':
        return 'is-complete';
      default:
        return 'is-progress';
    }
  }

  trackByDay(_: number, day: CalendarDay): string {
    return day.iso;
  }

  labelAcessivelDia(day: CalendarDay): string {
    const data = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    }).format(day.date);
    const total = day.events.length;
    const sufixo = total === 1 ? 'compromisso' : 'compromissos';
    return `${data}. ${total} ${sufixo}.`;
  }

  private get eventosDoMes(): AgendaEvento[] {
    return this.eventos.filter((evento) => {
      const data = this.parseIsoDate(evento.data);
      return (
        data.getMonth() === this.visibleMonth.getMonth() &&
        data.getFullYear() === this.visibleMonth.getFullYear()
      );
    });
  }

  private rebuildCalendar(): void {
    const firstDay = this.startOfMonth(this.visibleMonth);
    const startWeekday = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - startWeekday);

    const todayIso = this.toIsoDate(new Date());
    this.days = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const iso = this.toIsoDate(date);
      const events = this.listarEventosDoDia(iso);

      return {
        iso,
        date,
        inCurrentMonth: date.getMonth() === this.visibleMonth.getMonth(),
        isToday: iso === todayIso,
        isSelected: iso === this.selectedDateIso,
        hasUrgent: events.some((evento) => evento.status === 'Urgente'),
        hasOverdue: events.some((evento) => evento.status === 'Atrasado'),
        events
      };
    });

    this.eventosSelecionados = this.listarEventosDoDia(this.selectedDateIso);
  }

  private listarEventosDoDia(iso: string): AgendaEvento[] {
    return this.eventos
      .filter((evento) => evento.data === iso)
      .sort(
        (primeiro, segundo) =>
          this.prioridadeStatus(primeiro.status) - this.prioridadeStatus(segundo.status) ||
          primeiro.titulo.localeCompare(segundo.titulo, 'pt-BR')
      );
  }

  private prioridadeStatus(status: ProcessoStatusVisual): number {
    switch (status) {
      case 'Atrasado':
        return 0;
      case 'Urgente':
        return 1;
      case 'Concluído':
        return 3;
      default:
        return 2;
    }
  }

  private existeData(iso: string): boolean {
    return this.eventos.some((evento) => evento.data === iso);
  }

  private startOfMonth(base: Date): Date {
    return new Date(base.getFullYear(), base.getMonth(), 1);
  }

  private parseIsoDate(iso: string): Date {
    return new Date(`${iso}T12:00:00`);
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
