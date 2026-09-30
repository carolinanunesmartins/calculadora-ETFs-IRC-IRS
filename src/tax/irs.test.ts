import { describe, expect, it } from 'vitest';
import {
  antiguidadeDesconto,
  calcAdicionalSolidariedade,
  calcIrsBase,
  calcIrsTotal,
  calcRendimentoColetavel,
} from './irs';

describe('calcIrsBase', () => {
  it('é zero sem rendimento', () => {
    expect(calcIrsBase(0)).toBe(0);
    expect(calcIrsBase(-100)).toBe(0);
  });

  it('aplica o primeiro escalão sem parcela a abater', () => {
    expect(calcIrsBase(8000)).toBeCloseTo(1000);
  });

  it('aplica taxa e parcela a abater do escalão correspondente', () => {
    expect(calcIrsBase(20000)).toBeCloseTo(3345.47);
    expect(calcIrsBase(30000)).toBeCloseTo(6262.15);
  });
});

describe('calcAdicionalSolidariedade', () => {
  it('é zero até 80.000€', () => {
    expect(calcAdicionalSolidariedade(80000)).toBe(0);
  });

  it('aplica 2,5% entre 80.000€ e 250.000€', () => {
    expect(calcAdicionalSolidariedade(100000)).toBeCloseTo(500);
  });

  it('aplica 5% acima de 250.000€', () => {
    expect(calcAdicionalSolidariedade(300000)).toBeCloseTo(6750);
  });
});

describe('calcIrsTotal', () => {
  it('soma IRS base e taxa adicional', () => {
    expect(calcIrsTotal(100000)).toBeCloseTo(100000 * 0.48 - 11387.28 + 500);
  });
});

describe('antiguidadeDesconto', () => {
  it.each([
    [1, 0],
    [2, 0.1],
    [4, 0.1],
    [5, 0.2],
    [7, 0.2],
    [8, 0.3],
    [20, 0.3],
  ])('%i anos → %f', (anos, desconto) => {
    expect(antiguidadeDesconto(anos)).toBe(desconto);
  });
});

describe('calcRendimentoColetavel', () => {
  it('desconta o mínimo de 8,54 × IAS (4.587,09€ em 2026)', () => {
    expect(calcRendimentoColetavel(20000)).toBeCloseTo(20000 - 8.54 * 537.13);
  });

  it('desconta 11% para a Segurança Social quando é maior que o mínimo', () => {
    expect(calcRendimentoColetavel(50000)).toBeCloseTo(44500);
  });

  it('nunca fica negativo', () => {
    expect(calcRendimentoColetavel(3000)).toBe(0);
  });
});
