import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrasilApiCnpjService } from './brasilapi-cnpj.service';

afterEach(() => vi.unstubAllGlobals());

describe('BrasilApiCnpjService', () => {
  it('consulta somente o CNPJ e retorna apenas campos úteis ao cadastro', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        razao_social: ' Escritório Exemplo Ltda ', cep: '01001000', logradouro: 'Praça da Sé',
        numero: '10', complemento: 'Sala 2', bairro: 'Sé', municipio: 'São Paulo', uf: 'SP',
        qsa: [{ nome_socio: 'Não deve ser salvo' }]
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    const dados = await new BrasilApiCnpjService().buscar('19.131.243/0001-97');

    expect(fetchMock).toHaveBeenCalledWith('https://brasilapi.com.br/api/cnpj/v1/19131243000197', { signal: undefined });
    expect(dados).toEqual({
      razaoSocial: 'Escritório Exemplo Ltda', cep: '01001000', logradouro: 'Praça da Sé',
      numero: '10', complemento: 'Sala 2', bairro: 'Sé', cidade: 'São Paulo', estado: 'SP'
    });
  });

  it('não envia CNPJ incompleto', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(new BrasilApiCnpjService().buscar('123')).rejects.toThrow('14 caracteres');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('permite preencher manualmente quando a fonte está indisponível', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(new BrasilApiCnpjService().buscar('19131243000197')).rejects.toThrow('Preencha os dados manualmente');
  });
});
