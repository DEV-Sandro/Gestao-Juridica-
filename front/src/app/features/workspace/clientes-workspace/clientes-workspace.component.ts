import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../../auth.service';
import { ClientePayload, ClienteRecord } from '../../../models/client.model';

const FORM_VAZIO: ClientePayload = {
  nome: '',
  cpf: '',
  email: '',
  telefone: '',
  documentoSecundario: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
  observacoes: ''
};

@Component({
  selector: 'app-clientes-workspace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './clientes-workspace.component.html',
  styleUrls: ['./clientes-workspace.component.scss']
})
export class ClientesWorkspaceComponent implements OnInit {
  readonly clientesPorPagina = 15;

  private authService = inject(AuthService);
  private snack = inject(MatSnackBar);

  clientes: ClienteRecord[] = [];
  carregando = false;
  salvando = false;
  excluindo = false;
  clienteSelecionadoId: string | null = null;
  buscaCliente = '';
  paginaAtual = 1;
  form: ClientePayload = { ...FORM_VAZIO };

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.authService.listarClientes().subscribe({
      next: (clientes) => {
        this.clientes = clientes;
        if (!this.clienteSelecionadoId && clientes.length > 0) {
          this.selecionarCliente(clientes[0]);
        }
        this.normalizarPaginacao();
        this.carregando = false;
      },
      error: (error) => {
        this.carregando = false;
        this.snack.open(error?.error?.mensagem || 'Nao foi possivel carregar os clientes.', 'Fechar', {
          duration: 4000,
          panelClass: ['snack-error']
        });
      }
    });
  }

  novoCliente(): void {
    this.clienteSelecionadoId = null;
    this.form = { ...FORM_VAZIO };
  }

  selecionarCliente(cliente: ClienteRecord): void {
    this.clienteSelecionadoId = cliente.id;
    this.form = {
      nome: cliente.nome,
      cpf: cliente.cpf,
      email: cliente.email,
      telefone: cliente.telefone,
      documentoSecundario: cliente.documentoSecundario,
      endereco: cliente.endereco,
      numero: cliente.numero,
      complemento: cliente.complemento,
      bairro: cliente.bairro,
      cidade: cliente.cidade,
      estado: cliente.estado,
      cep: cliente.cep,
      observacoes: cliente.observacoes
    };
  }

  get clientesFiltrados(): ClienteRecord[] {
    const termo = this.buscaCliente.trim().toLowerCase();

    if (!termo) {
      return this.clientes;
    }

    return this.clientes.filter((cliente) => {
      const documento = `${cliente.cpf || ''}${cliente.documentoSecundario || ''}`.toLowerCase();
      return (
        cliente.nome.toLowerCase().includes(termo) ||
        (cliente.email || '').toLowerCase().includes(termo) ||
        documento.includes(termo)
      );
    });
  }

  get clientesPaginados(): ClienteRecord[] {
    const inicio = (this.paginaAtual - 1) * this.clientesPorPagina;
    return this.clientesFiltrados.slice(inicio, inicio + this.clientesPorPagina);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.clientesFiltrados.length / this.clientesPorPagina));
  }

  get resumoPaginacao(): string {
    if (this.clientesFiltrados.length === 0) {
      return 'Nenhum cliente encontrado';
    }

    const inicio = (this.paginaAtual - 1) * this.clientesPorPagina + 1;
    const fim = Math.min(this.paginaAtual * this.clientesPorPagina, this.clientesFiltrados.length);
    return `Mostrando ${inicio}-${fim} de ${this.clientesFiltrados.length} cliente(s)`;
  }

  onBuscaClienteChange(): void {
    this.paginaAtual = 1;
    this.normalizarPaginacao();
  }

  paginaAnterior(): void {
    if (this.paginaAtual <= 1) {
      return;
    }

    this.paginaAtual -= 1;
  }

  proximaPagina(): void {
    if (this.paginaAtual >= this.totalPaginas) {
      return;
    }

    this.paginaAtual += 1;
  }

  salvar(): void {
    if (!this.form.nome?.trim()) {
      this.snack.open('Informe o nome do cliente.', 'OK', {
        duration: 3000,
        panelClass: ['snack-error']
      });
      return;
    }

    this.salvando = true;
    const emEdicao = !!this.clienteSelecionadoId;

    const payload: ClientePayload = {
      ...this.form,
      nome: this.form.nome.trim(),
      estado: this.form.estado?.trim().toUpperCase() || null
    };

    const request$ = this.clienteSelecionadoId
      ? this.authService.atualizarCliente(this.clienteSelecionadoId, payload)
      : this.authService.criarCliente(payload);

    request$.subscribe({
      next: (cliente) => {
        this.salvando = false;
        this.clienteSelecionadoId = cliente.id;
        this.snack.open(
          emEdicao ? 'Cliente salvo com sucesso.' : 'Cliente criado com sucesso.',
          'OK',
          {
            duration: 3200,
            panelClass: ['snack-success']
          }
        );
        this.carregar();
      },
      error: (error) => {
        this.salvando = false;
        this.snack.open(error?.error?.mensagem || 'Nao foi possivel salvar o cliente.', 'Fechar', {
          duration: 4000,
          panelClass: ['snack-error']
        });
      }
    });
  }

  excluirCliente(): void {
    if (!this.clienteSelecionadoId) {
      return;
    }

    const clienteAtual = this.clientes.find((cliente) => cliente.id === this.clienteSelecionadoId);
    const nomeCliente = clienteAtual?.nome || 'este cliente';
    const confirmado = confirm(
      `Arquivar ${nomeCliente}?\n\nPara preservar o historico juridico, o cadastro sera inativado e deixara de aparecer nas listas ativas.`
    );

    if (!confirmado) {
      return;
    }

    this.excluindo = true;
    this.authService.excluirCliente(this.clienteSelecionadoId).subscribe({
      next: (resultado) => {
        this.excluindo = false;
        this.clienteSelecionadoId = null;
        this.form = { ...FORM_VAZIO };
        this.snack.open(
          resultado.possuiProcessosVinculados
            ? `Cliente inativado com seguranca. ${resultado.totalProcessosVinculados} processo(s) seguem preservados no historico.`
            : 'Cliente inativado com sucesso.',
          'OK',
          {
            duration: 4200,
            panelClass: ['snack-success']
          }
        );
        this.carregar();
      },
      error: (error) => {
        this.excluindo = false;
        this.snack.open(error?.error?.mensagem || 'Nao foi possivel inativar o cliente.', 'Fechar', {
          duration: 4000,
          panelClass: ['snack-error']
        });
      }
    });
  }

  private normalizarPaginacao(): void {
    if (this.paginaAtual > this.totalPaginas) {
      this.paginaAtual = this.totalPaginas;
    }

    if (this.paginaAtual < 1) {
      this.paginaAtual = 1;
    }
  }
}
