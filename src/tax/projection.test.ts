import { describe, expect, it } from 'vitest';
import { projectPath } from './projection';

describe('projectPath', () => {
  it('capitaliza juros compostos', () => {
    const p = projectPath(1000, 0, 0.1, 2);
    expect(p.valorFinal).toBeCloseTo(1210);
    expect(p.investido).toBe(1000);
    expect(p.path).toHaveLength(3);
  });

  it('adiciona o reforço no início de cada ano', () => {
    const p = projectPath(1000, 100, 0.1, 2);
    expect(p.valorFinal).toBeCloseTo(1441);
    expect(p.investido).toBe(1200);
  });

  it('desconta IRC anual sobre o ganho do ano', () => {
    const p = projectPath(100000, 0, 0.1, 1, { usarReduzida: true, regimeIrc: 'continente' });
    expect(p.ircAcumulado).toBeCloseTo(1500);
    expect(p.valorFinal).toBeCloseTo(108500);
  });
});
