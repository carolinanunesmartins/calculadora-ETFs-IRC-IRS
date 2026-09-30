import { describe, expect, it } from 'vitest';
import { nearestYear, niceTicks } from './chart';

// Área do gráfico com 900 de largura: começa em x = 66 e acaba em x = 890.
describe('nearestYear', () => {
  it('devolve o primeiro e o último ano nas pontas', () => {
    expect(nearestYear(66, 900, 10)).toBe(0);
    expect(nearestYear(890, 900, 10)).toBe(10);
  });

  it('arredonda para o ano mais próximo', () => {
    expect(nearestYear(66 + 824 * 0.5, 900, 10)).toBe(5);
    expect(nearestYear(66 + 824 * 0.54, 900, 10)).toBe(5);
    expect(nearestYear(66 + 824 * 0.56, 900, 10)).toBe(6);
  });

  it('fica dentro dos limites fora da área do gráfico', () => {
    expect(nearestYear(0, 900, 10)).toBe(0);
    expect(nearestYear(2000, 900, 10)).toBe(10);
  });
});

describe('niceTicks', () => {
  it('usa valores redondos que cobrem o máximo', () => {
    expect(niceTicks(286876)).toEqual([0, 100000, 200000, 300000]);
    expect(niceTicks(1210)).toEqual([0, 500, 1000, 1500]);
    expect(niceTicks(100000)).toEqual([0, 25000, 50000, 75000, 100000]);
  });

  it('tem sempre pelo menos um intervalo', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});
