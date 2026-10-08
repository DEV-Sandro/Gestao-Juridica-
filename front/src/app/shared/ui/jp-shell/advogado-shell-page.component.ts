import { Component } from '@angular/core';

import { ModuloAdvogadoComponent } from '../../../modulo-advogado/modulo-advogado';
import { JpShellComponent } from './jp-shell.component';

// Adaptador de rota: permite migrar a navegacao para o Shell sem reescrever as
// telas consolidadas do modulo do advogado em uma unica entrega.
@Component({
  selector: 'app-advogado-shell-page',
  standalone: true,
  imports: [JpShellComponent, ModuloAdvogadoComponent],
  template: `
    <jp-shell>
      <app-modulo-advogado></app-modulo-advogado>
    </jp-shell>
  `
})
export class AdvogadoShellPageComponent {}
