import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { aplicarTema } from './shared/theme';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <a class="skip-link" href="#conteudo-principal">Pular para o conteúdo</a>
    <div id="conteudo-principal" tabindex="-1" class="skip-target">Início do conteúdo</div>
    <router-outlet></router-outlet>
    @if (mostrarAviso) {
      <aside class="cookie-notice" [class.in-workspace]="emWorkspace" aria-label="Aviso de armazenamento do site">
        <p>Usamos armazenamento necessário para sua sessão e para lembrar o tema escolhido. Não usamos cookies de publicidade ou análise.</p>
        <a routerLink="/aviso-de-cookies">Ver detalhes</a>
        <button type="button" (click)="fecharAviso()">Entendi</button>
      </aside>
    }
  `,
  styleUrls: ['./app.scss']
})
export class AppComponent {
  title = 'front';
  mostrarAviso = localStorage.getItem('justapro-aviso-cookies') !== 'fechado';
  emWorkspace = window.location.pathname.startsWith('/advogado/');

  constructor(router: Router) {
    this.aplicarTemaSalvo();
    let rotaAtual = window.location.pathname + window.location.search;
    sessionStorage.removeItem('justapro-rota-anterior');
    router.events.subscribe(evento => {
      if (evento instanceof NavigationEnd) {
        const proximaRota = evento.urlAfterRedirects;
        this.emWorkspace = proximaRota.startsWith('/advogado/');
        if (proximaRota !== rotaAtual) sessionStorage.setItem('justapro-rota-anterior', rotaAtual);
        rotaAtual = proximaRota;
      }
    });
  }

  private aplicarTemaSalvo(): void {
    aplicarTema(localStorage.getItem('justapro-theme'));
  }

  fecharAviso(): void {
    localStorage.setItem('justapro-aviso-cookies', 'fechado');
    this.mostrarAviso = false;
  }
}
