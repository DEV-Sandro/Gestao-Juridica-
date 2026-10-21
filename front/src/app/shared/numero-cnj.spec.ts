import { describe, expect, it } from 'vitest';
import { formatarNumeroCnj, numeroCnjValido } from './numero-cnj';

describe('número CNJ', () => {
  it('aceita número real com dígito verificador correto', () => {
    expect(numeroCnjValido('0000336-84.2024.8.16.0052')).toBe(true);
    expect(formatarNumeroCnj('00003368420248160052')).toBe('0000336-84.2024.8.16.0052');
  });

  it('recusa dígito verificador alterado', () => {
    expect(numeroCnjValido('0000336-85.2024.8.16.0052')).toBe(false);
  });
});
