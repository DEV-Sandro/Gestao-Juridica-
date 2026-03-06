import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-modulo-advogado',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule, MatMenuModule
  ],
  templateUrl: './modulo-advogado.html',
  styleUrls: ['./modulo-advogado.scss']
})
export class ModuloAdvogadoComponent implements OnInit {
  
  listaDeProcessos: any[] = [];
  
  // Novos Campos do Formulário SaaS
  novoCliente = '';
  novoTipo = '';
  novaObservacao = '';
  novoPrazo = '';
  novoStatus = 'Em Andamento'; // Padrão
  idEmEdicao: string | null = null; 

  linksOAB: any = {};
  estadosOAB: string[] = [];

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.carregarDados();
    this.carregarTabelasOAB(); 
    
    // Carrega o tema do SaaS
    const temaSalvo = localStorage.getItem('advogaflow-tema') || 'claro';
    this.mudarTema(temaSalvo);
  }

  // 🎨 Novo Motor de Temas
  mudarTema(tema: string) {
    document.body.classList.remove('tema-premium', 'tema-elegante', 'tema-dark', 'claro');
    
    if (tema !== 'claro') {
      document.body.classList.add(tema);
    }
    localStorage.setItem('advogaflow-tema', tema);
  }

  carregarTabelasOAB() {
    this.authService.pegarTabelasOAB().subscribe({
      next: (dados: any) => {
        this.linksOAB = dados;
        this.estadosOAB = Object.keys(dados);
      }
    });
  }

  abrirTabelaOAB(estado: string) {
    const link = this.linksOAB[estado];
    if (link) window.open(link, '_blank');
  }

  carregarDados() {
    this.authService.listarProcessos().subscribe({
      next: (dados: any) => {
        this.listaDeProcessos = dados;
      },
      error: (e) => console.error(e)
    });
  }

  abrirCaso(id: string) {
    this.router.navigate(['/processo', id]);
  }

  salvar() {
    if (!this.novoCliente || !this.novoTipo) return alert('Preencha Cliente e Tipo da Ação!');

    const dados = {
      cliente: this.novoCliente,
      tipo: this.novoTipo,
      observacao: this.novaObservacao,
      prazo: this.novoPrazo,
      status: this.novoStatus,
      dataCriacao: new Date().toISOString()
    };

    if (this.idEmEdicao) {
      this.authService.atualizarProcesso(this.idEmEdicao, dados).subscribe({
        next: () => {
          this.cancelarEdicao();
          this.carregarDados();
        }
      });
    } else {
      this.authService.salvarProcesso(dados).subscribe({
        next: () => {
          this.cancelarEdicao();
          this.carregarDados();
        }
      });
    }
  }

  prepararEdicao(proc: any) {
    this.idEmEdicao = proc.id;
    this.novoCliente = proc.cliente;
    this.novoTipo = proc.tipo;
    this.novaObservacao = proc.observacao || '';
    this.novoPrazo = proc.prazo || '';
    this.novoStatus = proc.status || 'Em Andamento';
  }

  cancelarEdicao() {
    this.idEmEdicao = null;
    this.novoCliente = '';
    this.novoTipo = '';
    this.novaObservacao = '';
    this.novoPrazo = '';
    this.novoStatus = 'Em Andamento';
  }

  deletar(id: string) {
    if (confirm('Excluir este processo permanentemente?')) {
      this.authService.excluirProcesso(id).subscribe({
        next: () => this.carregarDados()
      });
    }
  }

  sair() {
    this.authService.logout();
  }
}