import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService, TemplateDocumento } from '../../../auth.service';
import { ClienteRecord } from '../../../models/client.model';
import {
  DocumentGeneratorService,
  DocumentTemplateDefinition,
  LEGAL_TEMPLATES
} from './document-generator.service';

interface ModeloView {
  origem: 'EMBUTIDO' | 'SERVIDOR';
  id: string;
  titulo: string;
  descricao: string;
  variaveis: string[];
  versao: number | null;
  embutido?: DocumentTemplateDefinition;
}

@Component({
  selector: 'app-documentos-workspace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './documentos-workspace.component.html',
  styleUrls: ['./documentos-workspace.component.scss']
})
export class DocumentosWorkspaceComponent implements OnInit {
  private authService = inject(AuthService);
  private generator = inject(DocumentGeneratorService);
  private snack = inject(MatSnackBar);

  modelos: ModeloView[] = [];
  modeloSelecionado: ModeloView | null = null;

  carregandoClientes = false;
  carregandoTemplates = false;
  gerando = false;
  clientes: ClienteRecord[] = [];
  clienteId = '';

  nomeDocumento = '';
  localAssinatura = '';
  referenciaProcesso = '';
  objetoContrato = '';
  contratoValor = '';
  contratoValorExtenso = '';

  // Upload de novo modelo (apenas ADMIN)
  mostrarUpload = false;
  enviandoTemplate = false;
  novoTemplateNome = '';
  novoTemplateDescricao = '';
  novoTemplateCategoria = '';
  private novoTemplateArquivoBase64: string | null = null;
  novoTemplateArquivoNome = '';

  ngOnInit(): void {
    this.carregarClientes();
    this.carregarTemplates();
  }

  get ehAdmin(): boolean {
    return this.authService.currentUser?.role === 'ADMIN';
  }

  private montarModelosEmbutidos(): ModeloView[] {
    return LEGAL_TEMPLATES.map((template) => ({
      origem: 'EMBUTIDO' as const,
      id: `embutido-${template.id}`,
      titulo: template.title,
      descricao: template.description,
      variaveis: [],
      versao: null,
      embutido: template
    }));
  }

  private montarModelosServidor(templates: TemplateDocumento[]): ModeloView[] {
    return templates.map((template) => ({
      origem: 'SERVIDOR' as const,
      id: template.id,
      titulo: template.nome,
      descricao: template.descricao || 'Modelo cadastrado pelo escritório.',
      variaveis: template.variaveis || [],
      versao: template.versaoAtual
    }));
  }

  carregarTemplates(): void {
    this.carregandoTemplates = true;
    this.authService.listarTemplates().subscribe({
      next: (templates) => {
        this.modelos = [...this.montarModelosEmbutidos(), ...this.montarModelosServidor(templates)];
        if (!this.modeloSelecionado && this.modelos.length > 0) {
          this.selecionarModelo(this.modelos[0]!);
        }
        this.carregandoTemplates = false;
      },
      error: () => {
        // Se o backend falhar, ao menos os modelos embutidos continuam disponíveis.
        this.modelos = this.montarModelosEmbutidos();
        if (!this.modeloSelecionado && this.modelos.length > 0) {
          this.selecionarModelo(this.modelos[0]!);
        }
        this.carregandoTemplates = false;
      }
    });
  }

  carregarClientes(): void {
    this.carregandoClientes = true;
    this.authService.listarClientes().subscribe({
      next: (clientes) => {
        this.clientes = clientes;
        if (!this.clienteId && clientes.length > 0) {
          this.clienteId = clientes[0]!.id;
          this.localAssinatura = clientes[0]!.cidade || '';
        }
        this.carregandoClientes = false;
      },
      error: (error) => {
        this.carregandoClientes = false;
        this.snack.open(error?.error?.mensagem || 'Nao foi possivel carregar os clientes.', 'Fechar', {
          duration: 4000,
          panelClass: ['snack-error']
        });
      }
    });
  }

  selecionarModelo(modelo: ModeloView): void {
    this.modeloSelecionado = modelo;
    if (!this.nomeDocumento.trim()) {
      this.nomeDocumento = modelo.titulo;
    }
  }

  async gerarDocumento(): Promise<void> {
    const cliente = this.clientes.find((item) => item.id === this.clienteId);
    const user = this.authService.currentUser;
    const nomeDocumento = this.nomeDocumento.trim();

    if (!this.modeloSelecionado) {
      this.snack.open('Selecione um modelo.', 'OK', { duration: 3200, panelClass: ['snack-error'] });
      return;
    }

    if (!nomeDocumento) {
      this.snack.open('Informe o nome do documento antes de gerar.', 'OK', {
        duration: 3200,
        panelClass: ['snack-error']
      });
      return;
    }

    if (!cliente) {
      this.snack.open('Selecione um cliente para montar o documento.', 'OK', {
        duration: 3200,
        panelClass: ['snack-error']
      });
      return;
    }

    if (!user) {
      this.snack.open('Sessao do usuario indisponivel. Recarregue a pagina.', 'Fechar', {
        duration: 3200,
        panelClass: ['snack-error']
      });
      return;
    }

    this.gerando = true;
    const extras = {
      localAssinatura: this.localAssinatura,
      referenciaProcesso: this.referenciaProcesso,
      objetoContrato: this.objetoContrato,
      contratoValor: this.contratoValor,
      contratoValorExtenso: this.contratoValorExtenso
    };

    try {
      if (this.modeloSelecionado.origem === 'EMBUTIDO' && this.modeloSelecionado.embutido) {
        await this.generator.download(this.modeloSelecionado.embutido, cliente, user, extras, nomeDocumento);
      } else {
        const buffer = await firstValueFrom(this.authService.baixarTemplateArquivo(this.modeloSelecionado.id));
        await this.generator.downloadFromBuffer(buffer as ArrayBuffer, cliente, user, extras, nomeDocumento);
      }

      this.snack.open('Documento DOCX gerado com sucesso.', 'OK', {
        duration: 3200,
        panelClass: ['snack-success']
      });
    } catch (error: any) {
      this.snack.open(error?.message || 'Nao foi possivel gerar o documento.', 'Fechar', {
        duration: 4200,
        panelClass: ['snack-error']
      });
    } finally {
      this.gerando = false;
    }
  }

  // ---- Upload de novo modelo (ADMIN) ----

  alternarUpload(): void {
    this.mostrarUpload = !this.mostrarUpload;
  }

  aoSelecionarArquivo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    if (!arquivo) return;

    if (!arquivo.name.toLowerCase().endsWith('.docx')) {
      this.snack.open('Selecione um arquivo .docx.', 'OK', { duration: 3200, panelClass: ['snack-error'] });
      return;
    }

    this.novoTemplateArquivoNome = arquivo.name;
    if (!this.novoTemplateNome.trim()) {
      this.novoTemplateNome = arquivo.name.replace(/\.docx$/i, '');
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.novoTemplateArquivoBase64 = String(reader.result || '');
    };
    reader.readAsDataURL(arquivo);
  }

  enviarTemplate(): void {
    if (!this.novoTemplateNome.trim()) {
      this.snack.open('Informe o nome do modelo.', 'OK', { duration: 3000, panelClass: ['snack-error'] });
      return;
    }
    if (!this.novoTemplateArquivoBase64) {
      this.snack.open('Selecione o arquivo .docx do modelo.', 'OK', {
        duration: 3000,
        panelClass: ['snack-error']
      });
      return;
    }

    this.enviandoTemplate = true;
    this.authService
      .criarTemplate({
        nome: this.novoTemplateNome.trim(),
        descricao: this.novoTemplateDescricao.trim() || null,
        categoria: this.novoTemplateCategoria.trim() || null,
        arquivoBase64: this.novoTemplateArquivoBase64
      })
      .subscribe({
        next: (template) => {
          this.enviandoTemplate = false;
          this.snack.open(
            `Modelo cadastrado. ${template.variaveis.length} variável(is) detectada(s).`,
            'OK',
            { duration: 4200, panelClass: ['snack-success'] }
          );
          this.limparUpload();
          this.mostrarUpload = false;
          this.carregarTemplates();
        },
        error: (error) => {
          this.enviandoTemplate = false;
          this.snack.open(error?.error?.mensagem || 'Nao foi possivel cadastrar o modelo.', 'Fechar', {
            duration: 4200,
            panelClass: ['snack-error']
          });
        }
      });
  }

  excluirModelo(modelo: ModeloView): void {
    if (modelo.origem !== 'SERVIDOR') return;
    if (!confirm(`Remover o modelo "${modelo.titulo}"?`)) return;

    this.authService.excluirTemplate(modelo.id).subscribe({
      next: () => {
        this.snack.open('Modelo removido.', 'OK', { duration: 2800 });
        if (this.modeloSelecionado?.id === modelo.id) {
          this.modeloSelecionado = null;
        }
        this.carregarTemplates();
      },
      error: (error) =>
        this.snack.open(error?.error?.mensagem || 'Erro ao remover modelo.', 'Fechar', {
          duration: 4000,
          panelClass: ['snack-error']
        })
    });
  }

  private limparUpload(): void {
    this.novoTemplateNome = '';
    this.novoTemplateDescricao = '';
    this.novoTemplateCategoria = '';
    this.novoTemplateArquivoBase64 = null;
    this.novoTemplateArquivoNome = '';
  }

  get clienteSelecionado(): ClienteRecord | null {
    return this.clientes.find((item) => item.id === this.clienteId) || null;
  }

  enderecoResumo(cliente: ClienteRecord): string {
    return (
      [
        cliente.endereco,
        cliente.numero,
        cliente.complemento,
        cliente.bairro,
        cliente.cidade,
        cliente.estado
      ]
        .filter((parte) => !!parte)
        .join(', ') || 'Nao informado'
    );
  }
}
