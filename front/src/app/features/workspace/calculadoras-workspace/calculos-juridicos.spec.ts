import { describe, expect, it } from 'vitest';
import { calcularHonorarios, calcularPrazoUtil } from './calculos-juridicos';

describe('cálculos jurídicos aritméticos', () => {
  it('exclui o dia inicial, o fim de semana e os feriados informados', () => {
    expect(calcularPrazoUtil('2026-10-23', 2, ['2026-10-26'])).toBe('2026-10-28');
  });

  it('rejeita datas inválidas e quantidades fora do limite', () => {
    expect(calcularPrazoUtil('2026-02-30', 1, [])).toBeNull();
    expect(calcularPrazoUtil('2026-10-21', 0, [])).toBeNull();
  });

  it('distribui os centavos entre as parcelas sem perder o total', () => {
    const resultado = calcularHonorarios(100, 10, 0, 3);
    expect(resultado?.total).toBe(10);
    expect(resultado?.parcelas).toEqual([3.34, 3.33, 3.33]);
  });

  it('rejeita entrada maior que o total', () => {
    expect(calcularHonorarios(100, 10, 11, 1)).toBeNull();
  });
});
