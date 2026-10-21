import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { voltarOuIrParaInicio } from '../shared/voltar-navegacao';

type Documento = 'termos' | 'cookies' | 'reembolso';

@Component({
  selector: 'app-informacoes-legais',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './informacoes-legais.html',
  styleUrl: './informacoes-legais.scss'
})
export class InformacoesLegaisComponent {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  readonly tipo = inject(ActivatedRoute).snapshot.data['documento'] as Documento;

  voltar(): void { voltarOuIrParaInicio(this.location, this.router); }
}
