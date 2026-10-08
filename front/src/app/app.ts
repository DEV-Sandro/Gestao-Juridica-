import { Component, HostListener, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { CommandPaletteService } from './core/search/command-palette.service';

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
  private readonly commandPalette = inject(CommandPaletteService);

  constructor() {
    this.aplicarTemaSalvo();
  }

  private aplicarTemaSalvo(): void {
    const temaSalvo = localStorage.getItem('justapro-theme') || 'corporate';
    document.body.setAttribute('data-theme', temaSalvo);
    document.documentElement.style.colorScheme = temaSalvo === 'light' ? 'light' : 'dark';
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.commandPalette.open();
    }
  }
}
