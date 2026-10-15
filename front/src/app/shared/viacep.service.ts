import { Injectable } from '@angular/core';

export interface EnderecoViaCep {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ViaCepService {
  async buscar(cep: string, signal?: AbortSignal): Promise<EnderecoViaCep> {
    const digitos = cep.replace(/\D/g, '');
    if (digitos.length !== 8) {
      throw new Error('Informe um CEP com 8 dígitos.');
    }

    // fetch evita que o interceptor da API envie o token de acesso ao ViaCEP.
    let resposta: Response;
    try {
      resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, { signal });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
    }
    if (!resposta.ok) {
      throw new Error('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
    }

    let endereco: EnderecoViaCep;
    try {
      endereco = (await resposta.json()) as EnderecoViaCep;
    } catch {
      throw new Error('A consulta do CEP retornou dados inválidos. Preencha o endereço manualmente.');
    }
    if (endereco.erro) {
      throw new Error('CEP não encontrado. Preencha o endereço manualmente.');
    }
    return endereco;
  }
}
