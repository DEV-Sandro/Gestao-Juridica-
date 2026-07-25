import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';

import { FAQ, FaqCategoria } from './faq-data';

@Component({
  selector: 'app-ajuda',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatExpansionModule, MatIconModule],
  templateUrl: './ajuda.html',
  styleUrls: ['./ajuda.scss']
})
export class AjudaComponent {
  termo = '';

  private normalizar(valor: string): string {
    return (valor || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  // Filtra perguntas e respostas por termo, mantendo apenas categorias com resultado.
  get categoriasFiltradas(): FaqCategoria[] {
    const t = this.normalizar(this.termo);
    if (!t) return FAQ;

    return FAQ.map((cat) => ({
      ...cat,
      itens: cat.itens.filter(
        (item) =>
          this.normalizar(item.pergunta).includes(t) || this.normalizar(item.resposta).includes(t)
      )
    })).filter((cat) => cat.itens.length > 0);
  }

  get totalResultados(): number {
    return this.categoriasFiltradas.reduce((soma, cat) => soma + cat.itens.length, 0);
  }

  limpar(): void {
    this.termo = '';
  }
}
