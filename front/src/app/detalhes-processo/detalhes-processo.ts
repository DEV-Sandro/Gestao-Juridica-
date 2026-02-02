import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { FormsModule } from '@angular/forms'; // Importante para os inputs
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox'; // Para marcar como feito

@Component({
  selector: 'app-detalhes-processo',
  standalone: true,
  imports: [
    CommonModule, FormsModule, 
    MatTabsModule, MatCardModule, MatButtonModule, 
    MatIconModule, MatInputModule, MatFormFieldModule, MatCheckboxModule
  ],
  templateUrl: './detalhes-processo.html',
  styleUrls: ['./detalhes-processo.scss']
})
export class DetalhesProcessoComponent implements OnInit {
  
  processo: any = null;
  id: string = '';
  
  // Variáveis da Timeline
  listaEtapas: any[] = [];
  novaEtapaTitulo = '';
  novaEtapaData = '';

  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    if (this.id) {
      this.carregarDetalhes();
      this.carregarEtapas(); // <--- Carrega a timeline
    }
  }

  carregarDetalhes() {
    this.auth.pegarProcessoPeloId(this.id).subscribe({
      next: (dados: any) => this.processo = dados
    });
  }

  // 👇 Lógica dos Prazos
  carregarEtapas() {
    this.auth.listarEtapas(this.id).subscribe({
      next: (dados: any) => this.listaEtapas = dados
    });
  }

  adicionarEtapa() {
    if (!this.novaEtapaTitulo || !this.novaEtapaData) return alert('Preencha título e data!');

    const dados = {
      titulo: this.novaEtapaTitulo,
      dataLimite: this.novaEtapaData
    };

    this.auth.criarEtapa(this.id, dados).subscribe({
      next: () => {
        this.novaEtapaTitulo = '';
        this.novaEtapaData = '';
        this.carregarEtapas(); // Atualiza a lista na hora
      }
    });
  }

  concluirEtapa(etapa: any) {
    const novoStatus = etapa.status === 'PENDENTE' ? 'CONCLUIDO' : 'PENDENTE';
    this.auth.atualizarStatusEtapa(this.id, etapa.id, novoStatus).subscribe({
      next: () => this.carregarEtapas()
    });
  }

  // Função auxiliar para ver se o prazo venceu
  estaAtrasado(data: string, status: string): boolean {
    if (status === 'CONCLUIDO') return false;
    const hoje = new Date().toISOString().split('T')[0];
    return data < hoje; // Se a data limite for menor que hoje, venceu!
  }

  voltar() {
    this.router.navigate(['/advogado']);
  }
}