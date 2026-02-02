import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion'; // <--- O Módulo Visual
import { ADVOGA_FLOW_KB } from '../kb-data'; // <--- Nossos Dados

@Component({
  selector: 'app-ajuda',
  standalone: true,
  imports: [CommonModule, MatExpansionModule], // <--- Adicione aqui
  templateUrl: './ajuda.html',
  styleUrls: ['./ajuda.scss']
})
export class AjudaComponent {
  // Carrega os dados do arquivo kb-data.ts
  baseConhecimento = ADVOGA_FLOW_KB.knowledge_units;
}