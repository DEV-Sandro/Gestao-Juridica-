import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { voltarOuIrParaInicio } from '../shared/voltar-navegacao';

@Component({
  selector: 'app-politica-privacidade',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './politica-privacidade.html',
  styleUrls: ['./politica-privacidade.scss']
})
export class PoliticaPrivacidadeComponent {
  private location = inject(Location);
  private router = inject(Router);

  voltar(): void {
    voltarOuIrParaInicio(this.location, this.router);
  }
}
