import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../../auth.service';
import { ClienteRecord } from '../../../models/client.model';
import {
  DocumentGeneratorService,
  DocumentTemplateDefinition,
  LEGAL_TEMPLATES
} from './document-generator.service';

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

  readonly templates = LEGAL_TEMPLATES;

  carregandoClientes = false;
  gerando = false;
  clientes: ClienteRecord[] = [];
  clienteId = '';
  templateSelecionado: DocumentTemplateDefinition = this.templates[0]!;

  localAssinatura = '';
  referenciaProcesso = '';
  objetoContrato = '';
  contratoValor = '';
  contratoValorExtenso = '';

  ngOnInit(): void {
    this.carregarClientes();
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

  selecionarTemplate(template: DocumentTemplateDefinition): void {
    this.templateSelecionado = template;
  }

  async gerarDocumento(): Promise<void> {
    const cliente = this.clientes.find((item) => item.id === this.clienteId);
    const user = this.authService.currentUser;

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

    try {
      await this.generator.download(this.templateSelecionado, cliente, user, {
        localAssinatura: this.localAssinatura,
        referenciaProcesso: this.referenciaProcesso,
        objetoContrato: this.objetoContrato,
        contratoValor: this.contratoValor,
        contratoValorExtenso: this.contratoValorExtenso
      });

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
