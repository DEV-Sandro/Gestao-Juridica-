import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ConviteMembroPayload, UserRole } from '../../../models/app-user.model';

@Component({
  selector: 'app-convidar-membro-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './convidar-membro-dialog.component.html',
  styleUrls: ['./convidar-membro-dialog.component.scss']
})
export class ConvidarMembroDialogComponent {
  private ref = inject(MatDialogRef<ConvidarMembroDialogComponent>);

  email = '';
  displayName = '';
  role: UserRole = 'ADVOGADO';
  cargo = '';
  oab = '';
  enviando = false;
  erro: string | null = null;

  fechar() {
    if (!this.enviando) this.ref.close(null);
  }

  enviar() {
    this.erro = null;
    if (!this.email.trim() || !this.displayName.trim()) {
      this.erro = 'Preencha o nome e o e-mail.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) {
      this.erro = 'E-mail inválido.';
      return;
    }
    const payload: ConviteMembroPayload = {
      email: this.email.trim(),
      displayName: this.displayName.trim(),
      role: this.role,
      cargo: this.cargo.trim() || undefined,
      oab: this.oab.trim() || undefined
    };
    this.ref.close(payload);
  }
}
