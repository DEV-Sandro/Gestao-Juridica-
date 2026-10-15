import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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

  constructor() {
    this.aplicarTemaSalvo();
  }

  private aplicarTemaSalvo(): void {
    aplicarTema(localStorage.getItem('justapro-theme'));
  }
}
