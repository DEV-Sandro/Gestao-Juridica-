import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-modulo-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatCardModule, MatButtonModule, MatInputModule, MatFormFieldModule],
  templateUrl: './modulo-cliente.html',
  styleUrls: ['./modulo-cliente.scss']
})
export class ModuloClienteComponent implements OnInit {
  
  meusProcessos: any[] = [];
  mostraFormulario = false;
  
  // Dados da nova solicitação
  novoTipo = '';
  novoDescricao = '';

  constructor(private auth: AuthService) {}

  ngOnInit() {
    this.carregarMeusProcessos();
  }

  carregarMeusProcessos() {
    // Por enquanto pegamos todos, em breve filtraremos só os deste cliente
    this.auth.listarProcessos().subscribe({
      next: (dados: any) => this.meusProcessos = dados
    });
  }

  enviarSolicitacao() {
    if (!this.novoTipo) return alert('Diga o que você precisa!');

    const solicitacao = {
      cliente: 'Eu (Cliente Logado)', // Depois pegaremos o nome real automático
      tipo: this.novoTipo,
      descricao: this.novoDescricao,
      status: 'Aguardando Análise 🕒' // Status inicial diferente
    };

    this.auth.salvarProcesso(solicitacao).subscribe({
      next: () => {
        alert('Solicitação enviada para o Dr. Sandro!');
        this.mostraFormulario = false; // Fecha o formulário
        this.novoTipo = '';
        this.carregarMeusProcessos();
      }
    });
  }

  sair() {
    this.auth.logout();
  }
}
