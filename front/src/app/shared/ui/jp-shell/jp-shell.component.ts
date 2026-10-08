import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { NavigationStateService } from '../../../core/layout/navigation-state.service';
import { CommandPaletteService } from '../../../core/search/command-palette.service';

@Component({
  selector: 'jp-shell',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, RouterLink, RouterLinkActive],
  templateUrl: './jp-shell.component.html',
  styleUrls: ['./jp-shell.component.scss']
})
export class JpShellComponent {
  private readonly navigationState = inject(NavigationStateService);
  private readonly commandPalette = inject(CommandPaletteService);

  readonly currentSectionTitle = this.navigationState.sectionTitle;
  readonly currentSubnavLinks = this.navigationState.subnavLinks;

  abrirCommandPalette(): void {
    this.commandPalette.open();
  }
}
