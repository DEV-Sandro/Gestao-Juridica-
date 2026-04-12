import { Injectable } from '@angular/core';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';

import { AppUser } from '../../../models/app-user.model';
import { ClienteRecord } from '../../../models/client.model';

export interface DocumentTemplateSection {
  heading?: string;
  paragraphs: string[];
}

export interface DocumentTemplateDefinition {
  id: string;
  title: string;
  description: string;
  filePrefix: string;
  assetPath: string;
  sections: DocumentTemplateSection[];
}

export interface DocumentContextExtras {
  localAssinatura: string;
  referenciaProcesso: string;
  objetoContrato: string;
  contratoValor?: string;
  contratoValorExtenso?: string;
}

export const LEGAL_TEMPLATES: DocumentTemplateDefinition[] = [
  {
    id: 'procuracao',
    title: 'Procuracao',
    description: 'Modelo real do escritorio para representacao judicial do cliente.',
    filePrefix: 'procuracao',
    assetPath: 'assets/document-templates/procuracao-template.docx',
    sections: [
      {
        heading: 'Partes',
        paragraphs: [
          'Identifica outorgante e outorgado com dados do cliente e do advogado responsavel.'
        ]
      },
      {
        heading: 'Poderes',
        paragraphs: [
          'Mantem a clausula ampla do modelo original e acrescenta a referencia do processo.'
        ]
      },
      {
        heading: 'Fechamento',
        paragraphs: ['Completa local, data e assinatura do cliente.']
      }
    ]
  },
  {
    id: 'honorarios',
    title: 'Contrato de honorarios',
    description: 'Contrato base do escritorio com objeto, valor e assinaturas.',
    filePrefix: 'contrato-honorarios',
    assetPath: 'assets/document-templates/contrato-honorarios-template.docx',
    sections: [
      {
        heading: 'Partes',
        paragraphs: [
          'Preenche cliente, advogado, contatos e endereco principal do cadastro.'
        ]
      },
      {
        heading: 'Objeto e valores',
        paragraphs: [
          'Usa o objeto do processo e aceita valor/valor por extenso no momento da geracao.'
        ]
      },
      {
        heading: 'Assinaturas',
        paragraphs: ['Atualiza a data, a linha da OAB e o fechamento do cliente.']
      }
    ]
  },
  {
    id: 'declaracao',
    title: 'Declaracao de hipossuficiencia',
    description: 'Versao editavel e enxuta da declaracao para o cliente principal do processo.',
    filePrefix: 'declaracao-hipossuficiencia',
    assetPath: 'assets/document-templates/declaracao-hipossuficiencia-template.docx',
    sections: [
      {
        heading: 'Declaracao',
        paragraphs: [
          'Preenche cliente, CPF, endereco completo, local e data em uma estrutura pronta para assinatura.'
        ]
      }
    ]
  }
];

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

@Injectable({ providedIn: 'root' })
export class DocumentGeneratorService {
  async download(
    template: DocumentTemplateDefinition,
    cliente: ClienteRecord,
    user: AppUser,
    extras: DocumentContextExtras
  ): Promise<void> {
    const blob = await this.generate(template, cliente, user, extras);
    const slugNome = this.slugify(cliente.nome || 'cliente');
    saveAs(blob, `${template.filePrefix}-${slugNome}.docx`);
  }

  async generate(
    template: DocumentTemplateDefinition,
    cliente: ClienteRecord,
    user: AppUser,
    extras: DocumentContextExtras
  ): Promise<Blob> {
    const templateBuffer = await this.loadTemplateBuffer(template.assetPath);
    const zip = new PizZip(templateBuffer);
    const placeholders = this.buildPlaceholders(cliente, user, extras);

    try {
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => this.placeholderLine()
      });

      doc.render(placeholders);

      return doc.getZip().generate({
        type: 'blob',
        mimeType: MIME_DOCX
      });
    } catch (error) {
      console.error('[DocumentGeneratorService] Falha ao renderizar template', error);
      throw new Error('Nao foi possivel preencher o modelo juridico selecionado.');
    }
  }

  private async loadTemplateBuffer(assetPath: string): Promise<ArrayBuffer> {
    const response = await fetch(assetPath, {
      method: 'GET',
      headers: {
        Accept: MIME_DOCX
      }
    });

    if (!response.ok) {
      throw new Error(`Modelo indisponivel (${response.status}).`);
    }

    return response.arrayBuffer();
  }

  private buildPlaceholders(
    cliente: ClienteRecord,
    user: AppUser,
    extras: DocumentContextExtras
  ): Record<string, string> {
    const enderecoCompleto = [
      cliente.endereco,
      cliente.numero,
      cliente.complemento,
      cliente.bairro,
      cliente.cidade,
      cliente.estado,
      cliente.cep
    ]
      .map((parte) => this.cleanText(parte))
      .filter((parte): parte is string => !!parte)
      .join(', ');

    const cidadeEstado = [
      this.cleanText(cliente.cidade),
      this.cleanText(cliente.estado)
    ]
      .filter((parte): parte is string => !!parte)
      .join(' / ');

    return {
      cliente_nome: this.docValue(cliente.nome),
      cliente_cpf: this.docValue(cliente.cpf),
      cliente_documento_secundario: this.docValue(cliente.documentoSecundario),
      cliente_telefone: this.docValue(cliente.telefone),
      cliente_email: this.docValue(cliente.email),
      cliente_endereco_completo: this.docValue(enderecoCompleto),
      cliente_cidade_estado: this.docValue(cidadeEstado),
      advogado_nome: this.docValue(user.displayName),
      advogado_oab: this.docValue(user.oab),
      advogado_telefone: this.docValue(user.telefone),
      processo_referencia: this.docValue(extras.referenciaProcesso),
      processo_objeto: this.docValue(extras.objetoContrato),
      local_assinatura: this.docValue(extras.localAssinatura || cliente.cidade),
      data_extenso: this.formatarDataExtenso(new Date()),
      contrato_valor: this.docValue(extras.contratoValor),
      contrato_valor_extenso: this.docValue(extras.contratoValorExtenso)
    };
  }

  private docValue(value: string | null | undefined): string {
    const cleaned = this.cleanText(value);
    return cleaned || this.placeholderLine();
  }

  private cleanText(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const cleaned = value.trim();
    return cleaned || null;
  }

  private placeholderLine(): string {
    return '________________';
  }

  private formatarDataExtenso(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'cliente';
  }
}
