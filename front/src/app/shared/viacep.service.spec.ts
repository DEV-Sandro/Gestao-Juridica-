import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViaCepService } from './viacep.service';

describe('ViaCepService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('consulta oito dígitos e retorna rua, bairro, cidade e UF', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        cep: '01001-000', logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP'
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    const endereco = await new ViaCepService().buscar('01001-000');

    expect(fetchMock).toHaveBeenCalledWith('https://viacep.com.br/ws/01001000/json/', {
      signal: undefined
    });
    expect(endereco.localidade).toBe('São Paulo');
    expect(endereco.logradouro).toBe('Praça da Sé');
  });

  it('não consulta CEP incompleto e informa quando não foi encontrado', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ erro: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const service = new ViaCepService();

    await expect(service.buscar('01001')).rejects.toThrow('8 dígitos');
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(service.buscar('99999-999')).rejects.toThrow('não encontrado');
  });

  it('permite preenchimento manual quando a rede falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network error')));
    await expect(new ViaCepService().buscar('01001000')).rejects.toThrow('Preencha o endereço manualmente');
  });
});
