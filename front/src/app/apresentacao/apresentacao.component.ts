import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { aplicarTema, AppTheme } from '../shared/theme';

type Visao = 'processos' | 'agenda' | 'financeiro';

@Component({
  selector: 'app-apresentacao',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  templateUrl: './apresentacao.component.html',
  styleUrl: './apresentacao.component.scss'
})
export class ApresentacaoComponent {
  temaAtual: AppTheme = aplicarTema(localStorage.getItem('justapro-theme'));
  visaoAtiva: Visao = 'processos';
  menuAberto = false;

  alternarTema(): void {
    this.temaAtual = aplicarTema(this.temaAtual === 'light' ? 'dark' : 'light');
  }

  selecionarVisao(visao: Visao): void {
    this.visaoAtiva = visao;
  }

  fecharMenu(): void {
    this.menuAberto = false;
  }
}
