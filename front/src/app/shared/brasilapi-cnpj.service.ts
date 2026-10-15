import { Injectable } from '@angular/core';

export interface DadosCnpj {
  razaoSocial: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

interface RespostaCnpj {
  razao_social?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
}

@Injectable({ providedIn: 'root' })
export class BrasilApiCnpjService {
  async buscar(cnpj: string, signal?: AbortSignal): Promise<DadosCnpj> {
    const codigo = cnpj.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z0-9]{12}\d{2}$/.test(codigo)) {
      throw new Error('Informe um CNPJ com 14 caracteres antes da consulta.');
    }

    let resposta: Response;
    try {
      // fetch impede que o interceptor da API envie o token do usuário à BrasilAPI.
      resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${codigo}`, { signal });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error('Não foi possível consultar o CNPJ. Preencha os dados manualmente.');
    }
    if (resposta.status === 404) {
      throw new Error('CNPJ não encontrado. Confira o número ou preencha manualmente.');
    }
    if (!resposta.ok) {
      throw new Error('A consulta de CNPJ está indisponível. Preencha os dados manualmente.');
    }

    let dados: RespostaCnpj;
    try {
      dados = (await resposta.json()) as RespostaCnpj;
    } catch {
      throw new Error('A consulta de CNPJ retornou dados inválidos. Preencha manualmente.');
    }
    if (!dados?.razao_social?.trim()) {
      throw new Error('A consulta de CNPJ não retornou a razão social. Preencha manualmente.');
    }

    return {
      razaoSocial: dados.razao_social.trim(),
      cep: dados.cep || '',
      logradouro: dados.logradouro || '',
      numero: dados.numero || '',
      complemento: dados.complemento || '',
      bairro: dados.bairro || '',
      cidade: dados.municipio || '',
      estado: dados.uf || ''
    };
  }
}
