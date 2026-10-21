import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../auth.service';
import { ClienteRecord } from '../../../models/client.model';
import { environment } from '../../../../environments/environment';
import {
  DocumentGeneratorService,
  DocumentTemplateDefinition,
  LEGAL_TEMPLATES
} from './document-generator.service';

interface ModeloPersonalizado {
  id: string;
  titulo: string;
  descricao: string;
  criadoPor: string;
  criadoEm: string;
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
  private http = inject(HttpClient);
  private readonly modelosUrl = `${environment.apiUrl}/api/modelos`;

  readonly templatesIniciais = LEGAL_TEMPLATES;
  modelosPersonalizados: ModeloPersonalizado[] = [];
  carregandoModelos = false;
  salvandoModelo = false;
  removendoModeloId = '';
  arquivoModelo: File | null = null;
  tituloModelo = '';
  descricaoModelo = '';
  mostrarNovoModelo = false;

  carregandoClientes = false;
  gerando = false;
  clientes: ClienteRecord[] = [];
  clienteId = '';
  templateSelecionado: DocumentTemplateDefinition = this.templatesIniciais[0]!;

  localAssinatura = '';
  referenciaProcesso = '';
  objetoContrato = '';
  contratoValor = '';
  contratoValorExtenso = '';

  ngOnInit(): void {
    this.carregarClientes();
    void this.carregarModelos();
  }

  get templates(): DocumentTemplateDefinition[] {
    return [...this.templatesIniciais, ...this.modelosPersonalizados.map(modelo => ({
      id: modelo.id,
      title: modelo.titulo,
      description: modelo.descricao || 'Modelo DOCX do escritório',
      filePrefix: modelo.titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'modelo',
      assetPath: '',
      custom: true,
      sections: [{ heading: 'Modelo do escritório', paragraphs: ['O documento será preenchido com os campos entre chaves existentes no arquivo DOCX. Revise o texto antes de utilizar.'] }]
    }))];
  }

  async carregarModelos(): Promise<void> {
    this.carregandoModelos = true;
    try { this.modelosPersonalizados = await firstValueFrom(this.http.get<ModeloPersonalizado[]>(this.modelosUrl)); }
    catch { this.snack.open('Não foi possível carregar os modelos do escritório.', 'Fechar', { duration: 3500, panelClass: ['snack-error'] }); }
    finally { this.carregandoModelos = false; }
  }

  selecionarArquivoModelo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const arquivo = input.files?.[0] || null;
    if (!arquivo) { this.arquivoModelo = null; return; }
    if (!/\.docx$/i.test(arquivo.name) || arquivo.size < 50 || arquivo.size > 2 * 1024 * 1024) {
      this.arquivoModelo = null;
      input.value = '';
      this.snack.open('Selecione um DOCX de até 2 MB.', 'Fechar', { duration: 3800, panelClass: ['snack-error'] });
      return;
    }
    this.arquivoModelo = arquivo;
    if (!this.tituloModelo.trim()) this.tituloModelo = arquivo.name.replace(/\.docx$/i, '').replace(/[-_]+/g, ' ').slice(0, 100);
  }

  async incluirModelo(): Promise<void> {
    const arquivo = this.arquivoModelo;
    const titulo = this.tituloModelo.trim();
    if (!arquivo || titulo.length < 3) {
      this.snack.open('Informe um título e escolha o arquivo DOCX.', 'Fechar', { duration: 3500, panelClass: ['snack-error'] });
      return;
    }
    this.salvandoModelo = true;
    try {
      const dadosBase64 = await new Promise<string>((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(String(leitor.result || '').split(',')[1] || '');
        leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
        leitor.readAsDataURL(arquivo);
      });
      const modelo = await firstValueFrom(this.http.post<ModeloPersonalizado>(this.modelosUrl, {
        titulo,
        descricao: this.descricaoModelo.trim(),
        dadosBase64
      }));
      this.modelosPersonalizados = [modelo, ...this.modelosPersonalizados];
      this.selecionarTemplate(this.templates.find(item => item.id === modelo.id)!);
      this.tituloModelo = '';
      this.descricaoModelo = '';
      this.arquivoModelo = null;
      this.mostrarNovoModelo = false;
      this.snack.open('Modelo incluído para a equipe do escritório.', 'OK', { duration: 3200, panelClass: ['snack-success'] });
    } catch (error: any) {
      this.snack.open(error?.error?.mensagem || error?.message || 'Não foi possível incluir o modelo.', 'Fechar', { duration: 4200, panelClass: ['snack-error'] });
    } finally { this.salvandoModelo = false; }
  }

  podeRemover(modelo: ModeloPersonalizado): boolean {
    const user = this.authService.currentUser;
    return !!user && (user.role === 'ADMIN' || modelo.criadoPor === user.uid);
  }

  async removerModelo(modelo: ModeloPersonalizado): Promise<void> {
    if (!window.confirm(`Remover definitivamente o modelo “${modelo.titulo}” do escritório?`)) return;
    this.removendoModeloId = modelo.id;
    try {
      await firstValueFrom(this.http.delete<void>(`${this.modelosUrl}/${modelo.id}`));
      this.modelosPersonalizados = this.modelosPersonalizados.filter(item => item.id !== modelo.id);
      if (this.templateSelecionado.id === modelo.id) this.templateSelecionado = this.templatesIniciais[0]!;
      this.snack.open('Modelo removido.', 'OK', { duration: 3000 });
    } catch (error: any) {
      this.snack.open(error?.error?.mensagem || 'Não foi possível remover o modelo.', 'Fechar', { duration: 3800, panelClass: ['snack-error'] });
    } finally { this.removendoModeloId = ''; }
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

  selecionarModeloPersonalizado(modelo: ModeloPersonalizado): void {
    const template = this.templates.find(item => item.id === modelo.id);
    if (template) this.selecionarTemplate(template);
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
      const sourceBuffer = this.templateSelecionado.custom
        ? await firstValueFrom(this.http.get(`${this.modelosUrl}/${this.templateSelecionado.id}/arquivo`, { responseType: 'arraybuffer' }))
        : undefined;
      await this.generator.download(this.templateSelecionado, cliente, user, {
        localAssinatura: this.localAssinatura,
        referenciaProcesso: this.referenciaProcesso,
        objetoContrato: this.objetoContrato,
        contratoValor: this.contratoValor,
        contratoValorExtenso: this.contratoValorExtenso
      }, sourceBuffer);

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
