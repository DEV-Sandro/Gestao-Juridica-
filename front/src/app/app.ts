import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

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

  constructor() {
    this.aplicarTemaSalvo();
  }

  private aplicarTemaSalvo(): void {
    const temaSalvo = localStorage.getItem('justapro-theme') || 'corporate';
    document.body.setAttribute('data-theme', temaSalvo);
    document.documentElement.style.colorScheme = temaSalvo === 'light' ? 'light' : 'dark';
  }
}
