import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router'; // <--- 1. Importou Router?
import { AuthService } from '../auth.service';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-modulo-advogado',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatCardModule, 
    MatButtonModule, 
    MatIconModule,
    MatInputModule,
    MatFormFieldModule
  ],
  templateUrl: './modulo-advogado.html',
  styleUrls: ['./modulo-advogado.scss']
})
export class ModuloAdvogadoComponent implements OnInit {
  
  listaDeProcessos: any[] = [];
  novoCliente = '';
  novoTipo = '';
  idEmEdicao: string | null = null; 

  // 👇 2. Injetou o Router aqui?
  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.carregarDados();
  }

  carregarDados() {
    this.authService.listarProcessos().subscribe({
      next: (dados: any) => this.listaDeProcessos = dados,
      error: (e) => console.error(e)
    });
  }

  // 👇 3. A Função que o botão chama existe?
  abrirCaso(id: string) {
    console.log('Tentando abrir o caso:', id); // Vai aparecer no console se funcionar
    this.router.navigate(['/processo', id]);
  }

  salvar() {
    if (!this.novoCliente || !this.novoTipo) return alert('Preencha os dados!');

    const dados = {
      cliente: this.novoCliente,
      tipo: this.novoTipo,
      status: 'Em Andamento'
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
  }

  cancelarEdicao() {
    this.idEmEdicao = null;
    this.novoCliente = '';
    this.novoTipo = '';
  }

  deletar(id: string) {
    if (confirm('Tem certeza que deseja excluir?')) {
      this.authService.excluirProcesso(id).subscribe({
        next: () => this.carregarDados()
      });
    }
  }

  sair() {
    this.authService.logout();
  }
}