import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit {
  
  listaDeProcessos: any[] = [];
  
  // Variáveis do formulário
  novoCliente = '';
  novoTipo = '';
  idEmEdicao: string | null = null; 

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.carregarDados();
  }

  carregarDados() {
    this.authService.listarProcessos().subscribe({
      next: (dados: any) => this.listaDeProcessos = dados,
      error: (e) => console.error(e)
    });
  }

  // Prepara o formulário para edição
  prepararEdicao(proc: any) {
    this.idEmEdicao = proc.id;
    this.novoCliente = proc.cliente;
    this.novoTipo = proc.tipo;
  }

  cancelarEdicao() {
    this.idEmEdicao = null;
    this.novoCliente = '';
    this.novoTipo = '';
  }

  // A função ADICIONAR/SALVAR (Que estava faltando)
  salvar() {
    if (!this.novoCliente || !this.novoTipo) return alert('Preencha tudo!');

    const dados = {
      cliente: this.novoCliente,
      tipo: this.novoTipo,
      status: 'Em Andamento'
    };

    if (this.idEmEdicao) {
      // Editar
      this.authService.atualizarProcesso(this.idEmEdicao, dados).subscribe({
        next: () => {
          alert('Atualizado com sucesso!');
          this.cancelarEdicao();
          this.carregarDados();
        }
      });
    } else {
      // Criar Novo
      this.authService.salvarProcesso(dados).subscribe({
        next: () => {
          alert('Criado com sucesso!');
          this.cancelarEdicao();
          this.carregarDados();
        }
      });
    }
  }

  // Função ADICIONAR (para compatibilidade com seu HTML antigo se houver)
  adicionar() {
    this.salvar();
  }

  // A função DELETAR (Que estava faltando)
  deletar(id: string) {
    if (confirm('Tem certeza?')) {
      this.authService.excluirProcesso(id).subscribe({
        next: () => this.carregarDados()
      });
    }
  }

  sair() {
    this.authService.logout();
  }
}