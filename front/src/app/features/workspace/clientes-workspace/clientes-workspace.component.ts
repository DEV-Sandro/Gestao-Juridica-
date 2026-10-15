import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../../auth.service';
import { ClientePayload, ClienteRecord } from '../../../models/client.model';
import { ViaCepService } from '../../../shared/viacep.service';
import { BrasilApiCnpjService } from '../../../shared/brasilapi-cnpj.service';

const FORM_VAZIO: ClientePayload = {
  nome: '',
  cpf: '',
  cnpj: '',
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
export class ClientesWorkspaceComponent implements OnInit, OnDestroy {
  readonly clientesPorPagina = 15;

  private authService = inject(AuthService);
  private snack = inject(MatSnackBar);
  private viaCep = inject(ViaCepService);
  private brasilApiCnpj = inject(BrasilApiCnpjService);
  private consultaCep?: AbortController;
  private consultaCnpj?: AbortController;

  clientes: ClienteRecord[] = [];
  carregando = false;
  salvando = false;
  excluindo = false;
  clienteSelecionadoId: string | null = null;
  buscaCliente = '';
  paginaAtual = 1;
  form: ClientePayload = { ...FORM_VAZIO };
  tipoDocumento: 'CPF' | 'CNPJ' = 'CPF';
  consultandoCep = false;
  mensagemCep = '';
  consultandoCnpj = false;
  mensagemCnpj = '';

  ngOnInit(): void {
    this.carregar();
  }

  ngOnDestroy(): void {
    this.consultaCep?.abort();
    this.consultaCnpj?.abort();
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
    this.consultaCep?.abort();
    this.consultaCnpj?.abort();
    this.clienteSelecionadoId = null;
    this.form = { ...FORM_VAZIO };
    this.tipoDocumento = 'CPF';
    this.mensagemCep = '';
    this.mensagemCnpj = '';
  }

  selecionarCliente(cliente: ClienteRecord): void {
    this.consultaCep?.abort();
    this.consultaCnpj?.abort();
    this.clienteSelecionadoId = cliente.id;
    const cnpjLegado = (cliente.documentoSecundario || '').replace(/[^A-Za-z0-9]/g, '').length === 14
      ? cliente.documentoSecundario : null;
    this.tipoDocumento = cliente.cnpj || cnpjLegado ? 'CNPJ' : 'CPF';
    this.form = {
      nome: cliente.nome,
      cpf: this.tipoDocumento === 'CPF' ? cliente.cpf : null,
      cnpj: cliente.cnpj || cnpjLegado,
      email: cliente.email,
      telefone: cliente.telefone,
      documentoSecundario: cnpjLegado ? null : cliente.documentoSecundario,
      endereco: cliente.endereco,
      numero: cliente.numero,
      complemento: cliente.complemento,
      bairro: cliente.bairro,
      cidade: cliente.cidade,
      estado: cliente.estado,
      cep: cliente.cep,
      observacoes: cliente.observacoes
    };
    this.mensagemCep = '';
    this.mensagemCnpj = '';
  }

  alterarTipoDocumento(tipo: 'CPF' | 'CNPJ'): void {
    this.consultaCnpj?.abort();
    this.mensagemCnpj = '';
    this.tipoDocumento = tipo;
    if (tipo === 'CPF') this.form.cnpj = null;
    else this.form.cpf = null;
  }

  aoAlterarCnpj(valor: string): void {
    this.consultaCnpj?.abort();
    this.consultandoCnpj = false;
    this.mensagemCnpj = '';
    this.form.cnpj = valor.toUpperCase().slice(0, 18);
  }

  async consultarCnpj(): Promise<void> {
    const consulta = new AbortController();
    this.consultaCnpj?.abort();
    this.consultaCnpj = consulta;
    this.consultandoCnpj = true;
    this.mensagemCnpj = '';
    try {
      const dados = await this.brasilApiCnpj.buscar(this.form.cnpj || '', consulta.signal);
      if (consulta.signal.aborted || this.tipoDocumento !== 'CNPJ') return;
      this.form.nome ||= dados.razaoSocial;
      this.form.cep ||= dados.cep.replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2');
      this.form.endereco ||= dados.logradouro;
      this.form.numero ||= dados.numero;
      this.form.complemento ||= dados.complemento;
      this.form.bairro ||= dados.bairro;
      this.form.cidade ||= dados.cidade;
      this.form.estado ||= dados.estado;
      this.mensagemCnpj = 'Dados encontrados. Os campos vazios foram preenchidos; confira antes de salvar.';
    } catch (error) {
      if (!consulta.signal.aborted) {
        this.mensagemCnpj = error instanceof Error ? error.message : 'Não foi possível consultar o CNPJ.';
      }
    } finally {
      if (this.consultaCnpj === consulta) this.consultandoCnpj = false;
    }
  }

  aoAlterarCep(valor: string): void {
    this.consultaCep?.abort();
    this.consultandoCep = false;
    this.mensagemCep = '';
    const digitos = valor.replace(/\D/g, '').slice(0, 8);
    this.form.cep = digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
    if (digitos.length === 8) void this.buscarCep(digitos);
  }

  private async buscarCep(cep: string): Promise<void> {
    const consulta = new AbortController();
    this.consultaCep = consulta;
    this.consultandoCep = true;
    try {
      const endereco = await this.viaCep.buscar(cep, consulta.signal);
      if (consulta.signal.aborted) return;
      this.form.endereco = endereco.logradouro || '';
      this.form.bairro = endereco.bairro || '';
      this.form.cidade = endereco.localidade || this.form.cidade;
      this.form.estado = endereco.uf || this.form.estado;
      this.mensagemCep = 'Endereço localizado. Confira o número e os demais dados.';
    } catch (error) {
      if (!consulta.signal.aborted) {
        this.mensagemCep = error instanceof Error ? error.message : 'Não foi possível consultar o CEP.';
      }
    } finally {
      if (this.consultaCep === consulta) this.consultandoCep = false;
    }
  }

  get clientesFiltrados(): ClienteRecord[] {
    const termo = this.buscaCliente.trim().toLowerCase();
    const termoDocumento = termo.replace(/[^a-z0-9]/g, '');

    if (!termo) {
      return this.clientes;
    }

    return this.clientes.filter((cliente) => {
      const documento = `${cliente.cpf || ''}${cliente.cnpj || ''}${cliente.documentoSecundario || ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');
      return (
        cliente.nome.toLowerCase().includes(termo) ||
        (cliente.email || '').toLowerCase().includes(termo) ||
        (termoDocumento && documento.includes(termoDocumento))
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

    const documento = (this.tipoDocumento === 'CPF' ? this.form.cpf : this.form.cnpj) || '';
    const caracteres = documento.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const formatoValido = this.tipoDocumento === 'CPF'
      ? /^\d{11}$/.test(caracteres)
      : /^[A-Z0-9]{12}\d{2}$/.test(caracteres);
    if (caracteres && !formatoValido) {
      this.snack.open(`Informe um ${this.tipoDocumento} no formato válido.`, 'OK', { duration: 3500 });
      return;
    }

    this.salvando = true;
    const emEdicao = !!this.clienteSelecionadoId;

    const payload: ClientePayload = {
      ...this.form,
      nome: this.form.nome.trim(),
      cpf: this.tipoDocumento === 'CPF' ? this.form.cpf : null,
      cnpj: this.tipoDocumento === 'CNPJ' ? this.form.cnpj : null,
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
