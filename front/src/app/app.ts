import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { aplicarTema } from './shared/theme';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet], // <--- Importante
  // 👇 AQUI ESTÁ O SEGREDO: O template TEM que ter isso
  template: `
    <router-outlet></router-outlet>
  `,
  styleUrls: ['./app.scss']
})
export class AppComponent {
  title = 'front';

  constructor(router: Router) {
    this.aplicarTemaSalvo();
    let rotaAtual = window.location.pathname + window.location.search;
    sessionStorage.removeItem('justapro-rota-anterior');
    router.events.subscribe(evento => {
      if (evento instanceof NavigationEnd) {
        const proximaRota = evento.urlAfterRedirects;
        if (proximaRota !== rotaAtual) sessionStorage.setItem('justapro-rota-anterior', rotaAtual);
        rotaAtual = proximaRota;
      }
    });
  }

  private aplicarTemaSalvo(): void {
    aplicarTema(localStorage.getItem('justapro-theme'));
  }
}
