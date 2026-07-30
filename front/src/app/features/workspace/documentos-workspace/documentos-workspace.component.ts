import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService, TemplateDocumento } from '../../../auth.service';
import { ClienteRecord } from '../../../models/client.model';
import {
  DocumentGeneratorService,
  DocumentTemplateDefinition,
  LEGAL_TEMPLATES
} from './document-generator.service';

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface ModeloView {
  origem: 'EMBUTIDO' | 'SERVIDOR';
  id: string;
  titulo: string;
  descricao: string;
  categoria: string | null;
  variaveis: string[];
  versao: number | null;
  criadoEm: string | null;
  atualizadoEm: string | null;
  favorito: boolean;
  embutido?: DocumentTemplateDefinition;
}

type Ordenacao = 'nome' | 'recentes';

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
    MatExpansionModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule
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

  mostrarComoFunciona = false;

  // Filtros / busca / ordenação da biblioteca de modelos.
  busca = '';
  filtroCategoria = 'Todas';
  ordenacao: Ordenacao = 'nome';

  // Favoritos são por usuário/navegador (não há campo no backend ainda).
  private readonly FAV_KEY = 'justapro-templates-favoritos';
  private favoritos = new Set<string>();

  // Estados de ações inline.
  modeloRenomeandoId: string | null = null;
  nomeEmEdicao = '';
  modeloExcluindoId: string | null = null;
  acaoEmCursoId: string | null = null;

  // Prévia do documento (modal).
  modeloPreview: ModeloView | null = null;

  // Variáveis REAIS que o gerador preenche automaticamente (delimitador de chave
  // simples, padrão do docxtemplater). Fonte: buildPlaceholders no
  // document-generator.service.ts — manter em sincronia.
  readonly gruposVariaveis: { grupo: string; itens: { chave: string; descricao: string }[] }[] = [
    {
      grupo: 'Cliente',
      itens: [
        { chave: 'cliente_nome', descricao: 'Nome completo do cliente' },
        { chave: 'cliente_cpf', descricao: 'CPF (formatado)' },
        { chave: 'cliente_rg', descricao: 'RG' },
        { chave: 'cliente_documento_secundario', descricao: 'Documento auxiliar (CNPJ, etc.)' },
        { chave: 'cliente_estado_civil', descricao: 'Estado civil' },
        { chave: 'cliente_nacionalidade', descricao: 'Nacionalidade' },
        { chave: 'cliente_profissao', descricao: 'Profissão' },
        { chave: 'cliente_telefone', descricao: 'Telefone' },
        { chave: 'cliente_email', descricao: 'E-mail' },
        { chave: 'cliente_endereco_completo', descricao: 'Endereço completo' },
        { chave: 'cliente_cidade_estado', descricao: 'Cidade / UF' }
      ]
    },
    {
      grupo: 'Advogado',
      itens: [
        { chave: 'advogado_nome', descricao: 'Nome do advogado responsável' },
        { chave: 'advogado_oab', descricao: 'Número da OAB' },
        { chave: 'advogado_telefone', descricao: 'Telefone do advogado' }
      ]
    },
    {
      grupo: 'Processo e documento',
      itens: [
        { chave: 'processo_referencia', descricao: 'Referência/número do processo' },
        { chave: 'processo_objeto', descricao: 'Objeto ou assunto do processo' },
        { chave: 'local_assinatura', descricao: 'Cidade da assinatura' },
        { chave: 'data_extenso', descricao: 'Data atual por extenso' },
        { chave: 'contrato_valor', descricao: 'Valor dos honorários' },
        { chave: 'contrato_valor_extenso', descricao: 'Valor por extenso' }
      ]
    }
  ];

  // Upload / edição de modelo (apenas ADMIN)
  mostrarUpload = false;
  enviandoTemplate = false;
  modeloEmEdicaoId: string | null = null;
  novoTemplateNome = '';
  novoTemplateDescricao = '';
  novoTemplateCategoria = '';
  private novoTemplateArquivoBase64: string | null = null;
  novoTemplateArquivoNome = '';

  ngOnInit(): void {
    this.favoritos = this.lerFavoritos();
    this.carregarClientes();
    this.carregarTemplates();
  }

  get ehAdmin(): boolean {
    return this.authService.currentUser?.role === 'ADMIN';
  }

  // ---------- Carga e montagem dos modelos ----------

  private montarModelosEmbutidos(): ModeloView[] {
    return LEGAL_TEMPLATES.map((template) => ({
      origem: 'EMBUTIDO' as const,
      id: `embutido-${template.id}`,
      titulo: template.title,
      descricao: template.description,
      categoria: 'Modelo padrão',
      variaveis: [],
      versao: null,
      criadoEm: null,
      atualizadoEm: null,
      favorito: this.favoritos.has(`embutido-${template.id}`),
      embutido: template
    }));
  }

  private montarModelosServidor(templates: TemplateDocumento[]): ModeloView[] {
    return templates.map((template) => ({
      origem: 'SERVIDOR' as const,
      id: template.id,
      titulo: template.nome,
      descricao: template.descricao || 'Modelo cadastrado pelo escritório.',
      categoria: template.categoria || null,
      variaveis: template.variaveis || [],
      versao: template.versaoAtual,
      criadoEm: template.criadoEm,
      atualizadoEm: template.atualizadoEm,
      favorito: this.favoritos.has(template.id)
    }));
  }

  carregarTemplates(): void {
    this.carregandoTemplates = true;
    this.authService.listarTemplates().subscribe({
      next: (templates) => {
        this.modelos = [...this.montarModelosEmbutidos(), ...this.montarModelosServidor(templates)];
        this.garantirSelecao();
        this.carregandoTemplates = false;
      },
      error: () => {
        // Se o backend falhar, ao menos os modelos embutidos continuam disponíveis.
        this.modelos = this.montarModelosEmbutidos();
        this.garantirSelecao();
        this.carregandoTemplates = false;
      }
    });
  }

  private garantirSelecao(): void {
    const visiveis = this.modelosFiltrados;
    if (this.modeloSelecionado && this.modelos.some((m) => m.id === this.modeloSelecionado!.id)) {
      // mantém a seleção; sincroniza a referência caso o objeto tenha sido recriado
      this.modeloSelecionado = this.modelos.find((m) => m.id === this.modeloSelecionado!.id) || null;
      return;
    }
    if (visiveis.length > 0) {
      this.selecionarModelo(visiveis[0]!);
    } else if (this.modelos.length > 0) {
      this.selecionarModelo(this.modelos[0]!);
    } else {
      this.modeloSelecionado = null;
    }
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

  // ---------- Busca / filtro / ordenação ----------

  private normalizar(valor: string): string {
    return (valor || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  get categoriasDisponiveis(): string[] {
    const set = new Set<string>();
    for (const modelo of this.modelos) {
      if (modelo.categoria) set.add(modelo.categoria);
    }
    return ['Todas', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }

  get modelosFiltrados(): ModeloView[] {
    const termo = this.normalizar(this.busca);

    const lista = this.modelos.filter((modelo) => {
      const okBusca =
        !termo ||
        this.normalizar(modelo.titulo).includes(termo) ||
        this.normalizar(modelo.descricao).includes(termo) ||
        this.normalizar(modelo.categoria || '').includes(termo);
      const okCategoria = this.filtroCategoria === 'Todas' || modelo.categoria === this.filtroCategoria;
      return okBusca && okCategoria;
    });

    return [...lista].sort((a, b) => {
      // Favoritos sempre no topo, independentemente da ordenação escolhida.
      if (a.favorito !== b.favorito) return a.favorito ? -1 : 1;
      if (this.ordenacao === 'recentes') {
        const da = a.atualizadoEm || a.criadoEm || '';
        const db = b.atualizadoEm || b.criadoEm || '';
        return db.localeCompare(da);
      }
      return a.titulo.localeCompare(b.titulo, 'pt-BR');
    });
  }

  get totalFavoritos(): number {
    return this.modelos.filter((m) => m.favorito).length;
  }

  get temFiltroAtivo(): boolean {
    return !!this.busca.trim() || this.filtroCategoria !== 'Todas';
  }

  limparFiltros(): void {
    this.busca = '';
    this.filtroCategoria = 'Todas';
  }

  // ---------- Seleção / geração ----------

  selecionarModelo(modelo: ModeloView): void {
    this.modeloSelecionado = modelo;
    if (!this.nomeDocumento.trim()) {
      this.nomeDocumento = modelo.titulo;
    }
  }

  gerarDeModelo(modelo: ModeloView): void {
    this.selecionarModelo(modelo);
    // Em telas estreitas o painel de montagem fica abaixo: leva o usuário até ele.
    setTimeout(() => {
      document.getElementById('painel-geracao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  // ---------- Prévia (modal) ----------

  abrirPreview(modelo: ModeloView, evento?: Event): void {
    evento?.stopPropagation();
    this.modeloPreview = modelo;
  }

  fecharPreview(): void {
    this.modeloPreview = null;
  }

  // Confirma a prévia: seleciona o modelo e dispara a geração (usa o cliente já
  // escolhido no painel de montagem; se não houver, avisa e leva o usuário até lá).
  confirmarPreviewGerar(): void {
    const modelo = this.modeloPreview;
    if (!modelo) return;

    this.selecionarModelo(modelo);
    this.fecharPreview();

    if (this.clienteId && this.clientes.length > 0) {
      void this.gerarDocumento();
    } else {
      this.gerarDeModelo(modelo);
    }
  }

  copiarVariavel(chave: string): void {
    const texto = `{${chave}}`;
    navigator.clipboard?.writeText(texto).then(
      () => this.snack.open(`${texto} copiado`, 'OK', { duration: 1800, panelClass: ['snack-success'] }),
      () => this.snack.open('Copie manualmente: ' + texto, 'OK', { duration: 2600 })
    );
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

  // ---------- Favoritos ----------

  private lerFavoritos(): Set<string> {
    try {
      const bruto = localStorage.getItem(this.FAV_KEY);
      const lista = bruto ? (JSON.parse(bruto) as string[]) : [];
      return new Set(Array.isArray(lista) ? lista : []);
    } catch {
      return new Set<string>();
    }
  }

  private persistirFavoritos(): void {
    try {
      localStorage.setItem(this.FAV_KEY, JSON.stringify(Array.from(this.favoritos)));
    } catch {
      /* armazenamento indisponível — favoritos ficam apenas na sessão atual */
    }
  }

  alternarFavorito(modelo: ModeloView, evento?: Event): void {
    evento?.stopPropagation();
    if (this.favoritos.has(modelo.id)) {
      this.favoritos.delete(modelo.id);
      modelo.favorito = false;
    } else {
      this.favoritos.add(modelo.id);
      modelo.favorito = true;
    }
    this.persistirFavoritos();
  }

  // ---------- Renomear (inline) ----------

  iniciarRenomear(modelo: ModeloView, evento?: Event): void {
    evento?.stopPropagation();
    this.modeloExcluindoId = null;
    this.modeloRenomeandoId = modelo.id;
    this.nomeEmEdicao = modelo.titulo;
  }

  cancelarRenomear(): void {
    this.modeloRenomeandoId = null;
    this.nomeEmEdicao = '';
  }

  confirmarRenomear(modelo: ModeloView): void {
    const nome = this.nomeEmEdicao.trim();
    if (!nome || nome === modelo.titulo) {
      this.cancelarRenomear();
      return;
    }

    this.acaoEmCursoId = modelo.id;
    this.authService.atualizarTemplate(modelo.id, { nome }).subscribe({
      next: () => {
        this.acaoEmCursoId = null;
        this.cancelarRenomear();
        this.snack.open('Modelo renomeado.', 'OK', { duration: 2400, panelClass: ['snack-success'] });
        this.carregarTemplates();
      },
      error: (error) => {
        this.acaoEmCursoId = null;
        this.snack.open(error?.error?.mensagem || 'Não foi possível renomear.', 'Fechar', {
          duration: 4000,
          panelClass: ['snack-error']
        });
      }
    });
  }

  // ---------- Duplicar ----------

  duplicarModelo(modelo: ModeloView, evento?: Event): void {
    evento?.stopPropagation();
    if (modelo.origem !== 'SERVIDOR') return;

    this.acaoEmCursoId = modelo.id;
    this.authService.duplicarTemplate(modelo.id).subscribe({
      next: (novo) => {
        this.acaoEmCursoId = null;
        this.snack.open(`Modelo duplicado como "${novo.nome}".`, 'OK', {
          duration: 3200,
          panelClass: ['snack-success']
        });
        this.carregarTemplates();
      },
      error: (error) => {
        this.acaoEmCursoId = null;
        this.snack.open(error?.error?.mensagem || 'Não foi possível duplicar o modelo.', 'Fechar', {
          duration: 4000,
          panelClass: ['snack-error']
        });
      }
    });
  }

  // ---------- Baixar arquivo bruto do modelo ----------

  async baixarModelo(modelo: ModeloView, evento?: Event): Promise<void> {
    evento?.stopPropagation();
    if (modelo.origem !== 'SERVIDOR') return;

    this.acaoEmCursoId = modelo.id;
    try {
      const buffer = await firstValueFrom(this.authService.baixarTemplateArquivo(modelo.id));
      const blob = new Blob([buffer as ArrayBuffer], { type: MIME_DOCX });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${modelo.titulo}.docx`;
      link.click();
      URL.revokeObjectURL(url);
      this.snack.open('Modelo baixado.', 'OK', { duration: 2400, panelClass: ['snack-success'] });
    } catch {
      this.snack.open('Não foi possível baixar o modelo.', 'Fechar', {
        duration: 3600,
        panelClass: ['snack-error']
      });
    } finally {
      this.acaoEmCursoId = null;
    }
  }

  // ---------- Excluir (confirmação inline) ----------

  pedirExclusao(modelo: ModeloView, evento?: Event): void {
    evento?.stopPropagation();
    if (modelo.origem !== 'SERVIDOR') return;
    this.modeloRenomeandoId = null;
    this.modeloExcluindoId = modelo.id;
  }

  cancelarExclusao(): void {
    this.modeloExcluindoId = null;
  }

  confirmarExclusao(modelo: ModeloView): void {
    this.acaoEmCursoId = modelo.id;
    this.authService.excluirTemplate(modelo.id).subscribe({
      next: () => {
        this.acaoEmCursoId = null;
        this.modeloExcluindoId = null;
        if (this.modeloSelecionado?.id === modelo.id) {
          this.modeloSelecionado = null;
        }
        this.snack.open('Modelo removido.', 'OK', { duration: 2800 });
        this.carregarTemplates();
      },
      error: (error) => {
        this.acaoEmCursoId = null;
        this.snack.open(error?.error?.mensagem || 'Erro ao remover modelo.', 'Fechar', {
          duration: 4000,
          panelClass: ['snack-error']
        });
      }
    });
  }

  // ---------- Upload / edição de modelo (ADMIN) ----------

  abrirNovoModelo(): void {
    this.modeloEmEdicaoId = null;
    this.limparUpload();
    this.mostrarUpload = true;
    this.mostrarComoFunciona = true;
    setTimeout(() => {
      document.getElementById('form-modelo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }

  iniciarEdicao(modelo: ModeloView, evento?: Event): void {
    evento?.stopPropagation();
    if (modelo.origem !== 'SERVIDOR') return;
    this.modeloEmEdicaoId = modelo.id;
    this.novoTemplateNome = modelo.titulo;
    this.novoTemplateDescricao = modelo.descricao === 'Modelo cadastrado pelo escritório.' ? '' : modelo.descricao;
    this.novoTemplateCategoria = modelo.categoria || '';
    this.novoTemplateArquivoBase64 = null;
    this.novoTemplateArquivoNome = '';
    this.mostrarUpload = true;
    setTimeout(() => {
      document.getElementById('form-modelo')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }

  fecharFormModelo(): void {
    this.mostrarUpload = false;
    this.modeloEmEdicaoId = null;
    this.limparUpload();
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

  salvarModelo(): void {
    if (!this.novoTemplateNome.trim()) {
      this.snack.open('Informe o nome do modelo.', 'OK', { duration: 3000, panelClass: ['snack-error'] });
      return;
    }

    if (this.modeloEmEdicaoId) {
      this.salvarEdicao(this.modeloEmEdicaoId);
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
          this.fecharFormModelo();
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

  private salvarEdicao(id: string): void {
    this.enviandoTemplate = true;
    this.authService
      .atualizarTemplate(id, {
        nome: this.novoTemplateNome.trim(),
        descricao: this.novoTemplateDescricao.trim() || null,
        categoria: this.novoTemplateCategoria.trim() || null
      })
      .subscribe({
        next: () => {
          // Se o admin também escolheu um novo arquivo, sobe como nova versão.
          if (this.novoTemplateArquivoBase64) {
            this.authService.adicionarVersaoTemplate(id, { arquivoBase64: this.novoTemplateArquivoBase64 }).subscribe({
              next: () => this.finalizarEdicao('Modelo atualizado (nova versão do arquivo).'),
              error: (error) => {
                this.enviandoTemplate = false;
                this.snack.open(error?.error?.mensagem || 'Metadados salvos, mas o arquivo falhou.', 'Fechar', {
                  duration: 4200,
                  panelClass: ['snack-error']
                });
              }
            });
          } else {
            this.finalizarEdicao('Modelo atualizado.');
          }
        },
        error: (error) => {
          this.enviandoTemplate = false;
          this.snack.open(error?.error?.mensagem || 'Não foi possível salvar as alterações.', 'Fechar', {
            duration: 4200,
            panelClass: ['snack-error']
          });
        }
      });
  }

  private finalizarEdicao(mensagem: string): void {
    this.enviandoTemplate = false;
    this.snack.open(mensagem, 'OK', { duration: 3200, panelClass: ['snack-success'] });
    this.fecharFormModelo();
    this.carregarTemplates();
  }

  private limparUpload(): void {
    this.novoTemplateNome = '';
    this.novoTemplateDescricao = '';
    this.novoTemplateCategoria = '';
    this.novoTemplateArquivoBase64 = null;
    this.novoTemplateArquivoNome = '';
  }

  // ---------- Helpers de exibição ----------

  formatarData(valor: string | null): string {
    if (!valor) return '—';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(data);
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
