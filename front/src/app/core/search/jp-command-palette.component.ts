import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { DialogRef } from '@angular/cdk/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { AuthService, ResultadoBusca } from '../../auth.service';

interface PaletteCommand {
  label: string;
  description: string;
  icon: string;
  path: string;
}

const COMMANDS: PaletteCommand[] = [
  { label: 'Abrir visao geral', description: 'Ir para o Dashboard', icon: 'dashboard', path: '/advogado/dashboard' },
  { label: 'Abrir processos', description: 'Consultar e organizar processos', icon: 'folder_special', path: '/advogado/processos' },
  { label: 'Abrir agenda', description: 'Ver prazos, audiencias e reunioes', icon: 'calendar_month', path: '/advogado/agenda' },
  { label: 'Abrir clientes', description: 'Consultar a base de clientes', icon: 'people', path: '/advogado/clientes' },
  { label: 'Abrir financeiro', description: 'Ver receitas e despesas', icon: 'account_balance_wallet', path: '/advogado/financeiro' },
  { label: 'Abrir rentabilidade', description: 'Analisar margem por processo', icon: 'insights', path: '/advogado/rentabilidade' },
  { label: 'Abrir documentos', description: 'Gerenciar modelos e documentos', icon: 'description', path: '/advogado/documentos' },
  { label: 'Abrir meu perfil', description: 'Atualizar dados e preferencias', icon: 'person', path: '/perfil' }
];

@Component({
  selector: 'jp-command-palette',
  standalone: true,
  imports: [CommonModule, A11yModule, MatIconModule],
  templateUrl: './jp-command-palette.component.html',
  styleUrls: ['./jp-command-palette.component.scss']
})
export class JpCommandPaletteComponent implements OnDestroy {
  private readonly dialogRef = inject(DialogRef);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly searchTerms = new Subject<string>();
  private readonly searchSubscription: Subscription;

  readonly query = signal('');
  readonly buscando = signal(false);
  readonly resultadoBusca = signal<ResultadoBusca | null>(null);
  readonly comandosFiltrados = computed(() => {
    const termo = this.query().trim().toLocaleLowerCase('pt-BR');
    if (!termo) return COMMANDS;

    return COMMANDS.filter((command) =>
      `${command.label} ${command.description}`.toLocaleLowerCase('pt-BR').includes(termo)
    );
  });

  constructor() {
    this.searchSubscription = this.searchTerms
      .pipe(debounceTime(220), distinctUntilChanged())
      .subscribe((termo) => this.buscarRegistros(termo));
  }

  onSearch(event: Event): void {
    const termo = (event.target as HTMLInputElement).value;
    this.query.set(termo);
    this.searchTerms.next(termo);
  }

  abrirComando(command: PaletteCommand): void {
    void this.router.navigateByUrl(command.path).then(() => this.dialogRef.close());
  }

  abrirProcesso(id: string): void {
    void this.router.navigate(['/processo', id]).then(() => this.dialogRef.close());
  }

  abrirClientes(): void {
    void this.router.navigateByUrl('/advogado/clientes').then(() => this.dialogRef.close());
  }

  fechar(): void {
    this.dialogRef.close();
  }

  ngOnDestroy(): void {
    this.searchSubscription.unsubscribe();
  }

  private buscarRegistros(termo: string): void {
    const consulta = termo.trim();
    if (consulta.length < 2) {
      this.resultadoBusca.set(null);
      this.buscando.set(false);
      return;
    }

    this.buscando.set(true);
    this.authService.buscarGlobal(consulta).subscribe({
      next: (resultado) => {
        this.resultadoBusca.set(resultado);
        this.buscando.set(false);
      },
      error: () => {
        this.resultadoBusca.set(null);
        this.buscando.set(false);
      }
    });
  }
}
