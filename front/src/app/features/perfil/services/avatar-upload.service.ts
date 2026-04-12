import { HttpClient, HttpEvent, HttpEventType, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AppUser } from '../../../models/app-user.model';

export interface UploadProgress {
  progress: number;
  state: 'running' | 'success' | 'error';
  profile?: AppUser;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AvatarUploadService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  static readonly MAX_BYTES = 5 * 1024 * 1024;
  static readonly TIPOS_PERMITIDOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  static readonly EXTENSOES_PERMITIDAS = ['jpg', 'jpeg', 'png', 'webp'];
  private static readonly TAMANHO_SAIDA = 720;

  validar(file: File): string | null {
    const extensao = file.name.split('.').pop()?.trim().toLowerCase() || '';
    const tipoValido =
      AvatarUploadService.TIPOS_PERMITIDOS.includes(file.type) ||
      AvatarUploadService.EXTENSOES_PERMITIDAS.includes(extensao);

    if (!tipoValido) {
      return 'Formato invalido. Aceitamos apenas JPG, PNG ou WEBP.';
    }

    if (file.size > AvatarUploadService.MAX_BYTES) {
      const tamMb = (file.size / 1024 / 1024).toFixed(2);
      return `Imagem muito grande (${tamMb}MB). Limite maximo: 5MB.`;
    }

    return null;
  }

  gerarPreview(file: File): string {
    return URL.createObjectURL(file);
  }

  async prepararImagemParaAvatar(file: File): Promise<File> {
    const erro = this.validar(file);
    if (erro) {
      throw new Error(erro);
    }

    const imagem = await this.carregarImagem(file);
    const largura = imagem.naturalWidth || imagem.width;
    const altura = imagem.naturalHeight || imagem.height;
    const lado = Math.min(largura, altura);

    if (lado <= 0) {
      throw new Error('Nao foi possivel processar esta imagem. Tente outro arquivo.');
    }

    const offsetX = Math.max(0, Math.floor((largura - lado) / 2));
    const offsetY = Math.max(0, Math.floor((altura - lado) / 2));
    const canvas = document.createElement('canvas');
    canvas.width = AvatarUploadService.TAMANHO_SAIDA;
    canvas.height = AvatarUploadService.TAMANHO_SAIDA;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Nao foi possivel preparar a imagem para upload.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      imagem,
      offsetX,
      offsetY,
      lado,
      lado,
      0,
      0,
      AvatarUploadService.TAMANHO_SAIDA,
      AvatarUploadService.TAMANHO_SAIDA
    );

    const mime = 'image/webp';
    const blob = await this.canvasToBlob(canvas, mime, 0.92);
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const preparado = new File([blob], `${baseName}-avatar.webp`, {
      type: mime,
      lastModified: Date.now()
    });

    const erroPreparado = this.validar(preparado);
    if (erroPreparado) {
      throw new Error(erroPreparado);
    }

    return preparado;
  }

  uploadComProgresso(_uid: string, file: File): Observable<UploadProgress> {
    return new Observable<UploadProgress>((subscriber) => {
      const erro = this.validar(file);
      if (erro) {
        subscriber.next({ progress: 0, state: 'error', error: erro });
        subscriber.complete();
        return;
      }

      const headers = new HttpHeaders({
        'Content-Type': file.type || 'image/jpeg',
        'X-File-Name': encodeURIComponent(file.name)
      });

      this.http
        .post<AppUser>(`${this.apiUrl}/api/me/avatar`, file, {
          headers,
          observe: 'events',
          reportProgress: true
        })
        .subscribe({
          next: (event: HttpEvent<AppUser>) => {
            if (event.type === HttpEventType.Sent) {
              subscriber.next({ progress: 0, state: 'running' });
              return;
            }

            if (event.type === HttpEventType.UploadProgress) {
              const total = event.total || file.size;
              const progress = total > 0 ? Math.round((event.loaded / total) * 100) : 0;
              subscriber.next({ progress, state: 'running' });
              return;
            }

            if (event instanceof HttpResponse && event.body) {
              subscriber.next({
                progress: 100,
                state: 'success',
                profile: event.body
              });
              subscriber.complete();
            }
          },
          error: (error) => {
            subscriber.next({
              progress: 0,
              state: 'error',
              error: error?.error?.mensagem || error?.message || 'Falha ao enviar a imagem.'
            });
            subscriber.complete();
          }
        });
    });
  }

  removerFotoAtual(): Observable<AppUser> {
    return this.http.delete<AppUser>(`${this.apiUrl}/api/me/avatar`);
  }

  private carregarImagem(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Nao foi possivel abrir a imagem selecionada.'));
      };

      image.src = objectUrl;
    });
  }

  private canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error('Falha ao gerar a versao otimizada da imagem.'));
      }, type, quality);
    });
  }
}
