import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../auth.service';
import { forkJoin, Subscription } from 'rxjs';
import { calcularHonorarios, calcularPrazoUtil } from './calculos-juridicos';
import { hojeLocalIso } from '../../../shared/data-local';

interface Feriado { date: string; name: string }

@Component({
  selector: 'app-calculadoras-workspace', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './calculadoras-workspace.component.html',
  styleUrls: ['./calculadoras-workspace.component.scss']
})
export class CalculadorasWorkspaceComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  aba: 'prazo' | 'honorarios' | 'oab' = 'prazo';
  dataInicial = hojeLocalIso();
  dias = 15;
  feriadosExtras = '';
  feriadosNacionais = new Map<string, string>();
  feriadosIgnorados = new Set<string>();
  estadoFeriados: 'carregando' | 'ok' | 'erro' = 'carregando';
  base = 10000;
  percentual = 10;
  entrada = 0;
  parcelas = 1;
  linksOab: Record<string, string> = { PR: 'https://tabela.oabpr.org.br/' };
  uf = 'PR';
  private feriadosSub?: Subscription;

  ngOnInit(): void {
    this.carregarFeriados();
    this.auth.pegarTabelasOAB().subscribe({
      next: links => { this.linksOab = { ...links, PR: 'https://tabela.oabpr.org.br/' }; },
      error: () => { /* O link oficial do PR permanece disponível. */ }
    });
  }

  ngOnDestroy(): void { this.feriadosSub?.unsubscribe(); }

  get ufs(): string[] { return Object.keys(this.linksOab).sort(); }
  get linkOab(): string | null { const url = this.linksOab[this.uf]; return url?.startsWith('https://') ? url : null; }
  get resultadoHonorarios() { return calcularHonorarios(Number(this.base), Number(this.percentual), Number(this.entrada), Number(this.parcelas)); }
  get feriadosManuais(): string[] { return this.feriadosExtras.split(/[\s,;]+/).filter(valor => /^\d{4}-\d{2}-\d{2}$/.test(valor)); }
  get dataFinal(): string | null { return calcularPrazoUtil(this.dataInicial, Number(this.dias), [...this.feriadosNacionais.keys()].filter(data => !this.feriadosIgnorados.has(data)).concat(this.feriadosManuais)); }
  get feriadosNoIntervalo(): Feriado[] {
    if (!this.dataFinal) return [];
    return [...this.feriadosNacionais].filter(([date]) => date > this.dataInicial && date <= this.dataFinal!).map(([date, name]) => ({ date, name }));
  }
  moeda(valor: number): string { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor); }
  formatarData(valor: string | null): string { return valor ? valor.split('-').reverse().join('/') : '—'; }
  alternarFeriado(data: string, considerar: boolean): void {
    if (considerar) this.feriadosIgnorados.delete(data);
    else this.feriadosIgnorados.add(data);
  }

  carregarFeriados(): void {
    this.feriadosSub?.unsubscribe();
    const anoInicial = Number(this.dataInicial.slice(0, 4));
    if (!Number.isInteger(anoInicial) || anoInicial < 1900 || anoInicial > 2197) { this.estadoFeriados = 'erro'; return; }
    this.estadoFeriados = 'carregando';
    this.feriadosNacionais.clear();
    this.feriadosIgnorados.clear();
    const consultas = [anoInicial, anoInicial + 1, anoInicial + 2].map(ano => this.http.get<Feriado[]>(`https://brasilapi.com.br/api/feriados/v1/${ano}`));
    this.feriadosSub = forkJoin(consultas).subscribe({
      next: listas => {
        for (const feriados of listas) for (const item of feriados) if (/^\d{4}-\d{2}-\d{2}$/.test(item.date)) this.feriadosNacionais.set(item.date, item.name);
        this.estadoFeriados = 'ok';
      },
      error: () => { this.feriadosNacionais.clear(); this.estadoFeriados = 'erro'; }
    });
  }
}
