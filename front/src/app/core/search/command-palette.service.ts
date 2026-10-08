import { Injectable, inject } from '@angular/core';
import { Dialog, DialogRef } from '@angular/cdk/dialog';

import { JpCommandPaletteComponent } from './jp-command-palette.component';

@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly dialog = inject(Dialog);
  private dialogRef: DialogRef<unknown, JpCommandPaletteComponent> | null = null;

  open(): void {
    if (this.dialogRef) return;

    this.dialogRef = this.dialog.open(JpCommandPaletteComponent, {
      width: '640px',
      maxWidth: 'calc(100vw - 32px)',
      panelClass: 'jp-command-palette-overlay',
      backdropClass: 'jp-command-palette-backdrop',
      ariaLabel: 'Buscar e executar comandos',
      hasBackdrop: true
    });

    this.dialogRef.closed.subscribe(() => (this.dialogRef = null));
  }

  close(): void {
    this.dialogRef?.close();
  }
}
