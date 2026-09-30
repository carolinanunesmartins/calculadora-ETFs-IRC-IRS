import { describe, expect, it } from 'vitest';
import { calcIrc } from './irc';

describe('calcIrc', () => {
  it('é zero sem lucro', () => {
    expect(calcIrc(0, true, 'continente')).toBe(0);
    expect(calcIrc(-5000, true, 'continente')).toBe(0);
  });

  it('aplica taxa PME aos primeiros 50.000€ e geral ao resto', () => {
    expect(calcIrc(60000, true, 'continente')).toBeCloseTo(9400);
  });

  it('aplica só a taxa geral sem PME', () => {
    expect(calcIrc(60000, false, 'madeira')).toBeCloseTo(7980);
  });

  it('usa as taxas da região', () => {
    expect(calcIrc(40000, true, 'acores')).toBeCloseTo(3500);
    expect(calcIrc(40000, true, 'interior')).toBeCloseTo(5000);
  });
});
