import { describe, expect, it } from 'vitest';
import { calcIrsTotal } from './irs';
import { withdrawCompany, withdrawPersonal, type WithdrawalPlan } from './withdrawal';

const PME_CONTINENTE = { usarReduzida: true, regimeIrc: 'continente' as const };
const partesIguais = (anos: number): WithdrawalPlan => ({ anos, valorAnual: 0 });

describe('withdrawPersonal', () => {
  it('de uma vez: aplica o desconto de antiguidade ao capital inicial', () => {
    const w = withdrawPersonal(1000, 0, 0.1, 2, partesIguais(1), 0);
    expect(w.bruto).toBeCloseTo(1210);
    expect(w.ganho).toBeCloseTo(210);
    expect(w.irsPessoal).toBeCloseTo(210 * 0.9 * 0.28);
  });

  it('de uma vez: conta a antiguidade de cada reforço desde que entrou', () => {
    // reforço do ano 1 fica 2 anos (−10%); o do ano 2 fica 1 ano (sem desconto)
    expect(withdrawPersonal(0, 1000, 0.1, 2, partesIguais(1), 0).irsPessoal).toBeCloseTo((210 * 0.9 + 100) * 0.28);
  });

  it('é zero sem ganho', () => {
    const w = withdrawPersonal(1000, 1000, 0, 5, partesIguais(3), 20000);
    expect(w.irsPessoal).toBe(0);
    expect(w.irsTransparencia).toBe(0);
  });

  it('faseado: vende metade do que resta e o resto continua a render', () => {
    // ano 0: vende 605 (custo 500); ano 1: o resto cresce para 665,5 (custo 500) e vende tudo
    const w = withdrawPersonal(1000, 0, 0.1, 2, partesIguais(2), 0);
    expect(w.bruto).toBeCloseTo(605 + 665.5);
    expect(w.ganho).toBeCloseTo(105 + 165.5);
    expect(w.irsPessoal).toBeCloseTo((105 + 165.5) * 0.9 * 0.28);
  });

  it('faseado: devolve o que fica investido depois de cada levantamento seguinte', () => {
    const w = withdrawPersonal(1000, 0, 0.1, 2, partesIguais(3), 0);
    // ano 0: vende 1/3 de 1210 → ficam 806,67; ano 1: cresce para 887,33, vende metade → 443,67; ano 2: vende tudo
    expect(w.path).toHaveLength(2);
    expect(w.path[0].year).toBe(1);
    expect(w.path[0].value).toBeCloseTo(443.67, 1);
    expect(w.path[0].invested).toBeCloseTo(333.33, 1);
    expect(w.path[1]).toEqual({ year: 2, invested: 0, value: 0 });
  });

  it('de uma vez não acrescenta pontos ao gráfico', () => {
    expect(withdrawPersonal(1000, 0, 0.1, 2, partesIguais(1), 0).path).toEqual([]);
  });

  it('faseado: a transparência paga IRS ano a ano pelos escalões', () => {
    const w = withdrawPersonal(100000, 0, 0.1, 1, partesIguais(2), 0);
    expect(w.irsTransparencia).toBeCloseTo(calcIrsTotal(5000) + calcIrsTotal(10500));
    expect(w.irsTransparencia).toBeLessThan(calcIrsTotal(15500));
  });

  it('valor fixo: vende esse valor por ano e o que sobra no último ano', () => {
    // 1210 no início; vende 500 → 710 → cresce para 781; vende 500 → 281 → cresce para 309,1 e vende tudo
    const w = withdrawPersonal(1000, 0, 0.1, 2, { anos: 3, valorAnual: 500 }, 0);
    expect(w.bruto).toBeCloseTo(500 + 500 + 309.1);
    expect(w.path[0].value).toBeCloseTo(281);
    expect(w.path.at(-1)).toEqual({ year: 2, invested: 0, value: 0 });
  });

  it('regista o valor bruto levantado em cada ano', () => {
    expect(withdrawPersonal(1000, 0, 0.1, 2, { anos: 3, valorAnual: 500 }, 0).saques.map((v) => +v.toFixed(2))).toEqual([500, 500, 309.1]);
    expect(withdrawCompany(1210, 1000, 0.1, partesIguais(2), { ...PME_CONTINENTE, anual: false }).saques.map((v) => +v.toFixed(2))).toEqual([605, 665.5]);
  });

  it('valor fixo: para quando o dinheiro acaba antes do limite', () => {
    const w = withdrawPersonal(1000, 0, 0, 1, { anos: 5, valorAnual: 600 }, 0);
    expect(w.bruto).toBeCloseTo(1000);
    expect(w.path[0]).toEqual({ year: 1, invested: 0, value: 0 });
    expect(w.path).toHaveLength(4);
  });
});

describe('withdrawCompany', () => {
  it('de uma vez: IRC sobre o ganho e 28% sobre o que sai', () => {
    const w = withdrawCompany(1210, 1000, 0.1, partesIguais(1), { ...PME_CONTINENTE, anual: false });
    expect(w.irc).toBeCloseTo(210 * 0.15);
    expect(w.dividendTax).toBeCloseTo((1210 - 210 * 0.15) * 0.28);
    expect(w.liquido).toBeCloseTo((1210 - 210 * 0.15) * 0.72);
  });

  it('faseado com IRC na venda: IRC e 28% em cada levantamento', () => {
    const w = withdrawCompany(1210, 1000, 0.1, partesIguais(2), { ...PME_CONTINENTE, anual: false });
    // ano 0: vende 605 (custo 500); ano 1: 605 → 665,5 (custo 500)
    const irc = (105 + 165.5) * 0.15;
    expect(w.bruto).toBeCloseTo(605 + 665.5);
    expect(w.ganho).toBeCloseTo(105 + 165.5);
    expect(w.irc).toBeCloseTo(irc);
    expect(w.liquido).toBeCloseTo((605 + 665.5 - irc) * 0.72);
  });

  it('faseado com IRC anual: o que fica paga IRC sobre o ganho de cada ano', () => {
    const w = withdrawCompany(1100, 1000, 0.1, partesIguais(2), { ...PME_CONTINENTE, anual: true });
    // ano 0: vende 550; ano 1: 550 rende 55, paga 8,25 de IRC e vende 596,75
    expect(w.irc).toBeCloseTo(8.25);
    expect(w.liquido).toBeCloseTo((550 + 596.75) * 0.72);
  });

  it('faseado: devolve o que fica na empresa depois de cada levantamento seguinte', () => {
    const w = withdrawCompany(1210, 1000, 0.1, partesIguais(2), { ...PME_CONTINENTE, anual: false });
    expect(w.path).toEqual([{ year: 1, invested: 0, value: 0 }]);
  });

  it('faseado: o limite PME de 50.000€ aplica-se em cada ano', () => {
    const deUmaVez = withdrawCompany(200000, 100000, 0, partesIguais(1), { ...PME_CONTINENTE, anual: false });
    const emDois = withdrawCompany(200000, 100000, 0, partesIguais(2), { ...PME_CONTINENTE, anual: false });
    expect(deUmaVez.irc).toBeCloseTo(50000 * 0.15 + 50000 * 0.19);
    expect(emDois.irc).toBeCloseTo(100000 * 0.15);
  });

  it('valor fixo: tirar metade por ano dá o mesmo que partes iguais em 2 anos', () => {
    const irc = { ...PME_CONTINENTE, anual: false };
    const fixo = withdrawCompany(1210, 1000, 0.1, { anos: 2, valorAnual: 605 }, irc);
    const partes = withdrawCompany(1210, 1000, 0.1, partesIguais(2), irc);
    expect(fixo.liquido).toBeCloseTo(partes.liquido);
    expect(fixo.irc).toBeCloseTo(partes.irc);
  });
});
