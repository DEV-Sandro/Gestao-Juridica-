import { CommonModule, Location } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { voltarOuIrParaInicio } from '../shared/voltar-navegacao';

interface Chamado {
  id: string;
  assunto: string;
  descricao: string;
  tipo: 'BUG' | 'DUVIDA' | 'SUGESTAO' | 'PRIVACIDADE';
  pagina: string | null;
  status: string;
  criadoEm: string;
  anexo: { nome: string; mime: string } | null;
}

@Component({
  selector: 'app-suporte',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './suporte.html',
  styleUrl: './suporte.scss'
})
export class SuporteComponent implements OnInit {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly url = `${environment.apiUrl}/api/suporte/chamados`;
  tipo: Chamado['tipo'] = 'BUG';
  assunto = '';
  descricao = '';
  pagina = '';
  arquivo: File | null = null;
  chamados: Chamado[] = [];
  carregando = true;
  enviando = false;
  erro = '';
  sucesso = '';

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('tipo') === 'PRIVACIDADE') this.tipo = 'PRIVACIDADE';
    void this.carregar();
  }

  voltar(): void { voltarOuIrParaInicio(this.location, this.router); }

  async carregar(): Promise<void> {
    try {
      this.chamados = await firstValueFrom(this.http.get<Chamado[]>(this.url));
      this.erro = '';
    } catch {
      this.erro = 'Não foi possível carregar seus chamados agora.';
    } finally {
      this.carregando = false;
    }
  }

  selecionarArquivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0] || null;
    this.erro = '';
    if (arquivo && (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(arquivo.type) || arquivo.size > 2.5 * 1024 * 1024)) {
      this.erro = 'Use um PDF ou imagem PNG, JPG ou WEBP de até 2,5 MB.';
      input.value = '';
      this.arquivo = null;
      return;
    }
    this.arquivo = arquivo;
  }

  removerArquivo(input: HTMLInputElement): void {
    input.value = '';
    this.arquivo = null;
  }

  async enviar(): Promise<void> {
    this.erro = '';
    this.sucesso = '';
    if (this.assunto.trim().length < 5 || this.descricao.trim().length < 20) {
      this.erro = 'Informe um assunto com 5 caracteres e descreva o ocorrido com pelo menos 20 caracteres.';
      return;
    }
    this.enviando = true;
    try {
      let anexo: { nome: string; mime: string; dadosBase64: string } | undefined;
      if (this.arquivo) {
        const dadosBase64 = await this.lerArquivo(this.arquivo);
        anexo = { nome: this.arquivo.name, mime: this.arquivo.type, dadosBase64 };
      }
      const novo = await firstValueFrom(this.http.post<Chamado>(this.url, {
        tipo: this.tipo,
        assunto: this.assunto.trim(),
        descricao: this.descricao.trim(),
        pagina: this.pagina.trim() || undefined,
        anexo
      }));
      this.chamados = [novo, ...this.chamados];
      this.assunto = '';
      this.descricao = '';
      this.pagina = '';
      this.arquivo = null;
      const input = document.querySelector<HTMLInputElement>('#suporte-anexo');
      if (input) input.value = '';
      this.sucesso = 'Chamado registrado. Você pode acompanhar o status abaixo.';
    } catch (e) {
      this.erro = e instanceof HttpErrorResponse && e.error?.mensagem ? e.error.mensagem : 'Não foi possível enviar o chamado. Tente novamente.';
    } finally {
      this.enviando = false;
    }
  }

  async baixarAnexo(chamado: Chamado): Promise<void> {
    try {
      const blob = await firstValueFrom(this.http.get(`${this.url}/${encodeURIComponent(chamado.id)}/anexo`, { responseType: 'blob' }));
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = chamado.anexo?.nome || 'anexo';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch {
      this.erro = 'Não foi possível baixar o anexo.';
    }
  }

  private lerArquivo(arquivo: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(String(leitor.result).split(',')[1] || '');
      leitor.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
      leitor.readAsDataURL(arquivo);
    });
  }
}
