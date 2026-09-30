import { describe, expect, it } from 'vitest';
import { calcIrc, IRC_REGIMES, PME_THRESHOLD, type RegimeIrc } from './irc';
import { calcAdicionalSolidariedade, calcIrsBase, calcIrsTotal, IRS_BRACKETS_2026 } from './irs';
import { computeResults, type Inputs, type Results } from './results';

// Verificação: coerência das tabelas, invariantes numa grelha de cenários e casos calculados à mão.

const base: Inputs = {
  capitalPessoal: 100000,
  aporteAnual: 0,
  retorno: 0.05,
  anos: 3,
  rendimentoBase: 30000,
  regimeIrc: 'continente',
  usarReduzida: true,
  ircAnual: false,
  distribui: true,
  customCapitalEmpresa: false,
  capitalEmpresaCustom: 0,
  aporteAnualEmpresaCustom: 0,
  anosLevantamento: 1,
  levantamentoAnual: 0,
};

const sum = (values: (number | undefined)[]) => values.reduce<number>((a, b) => a + (b ?? 0), 0);

describe('Tabelas fiscais: coerência interna', () => {
  // As parcelas publicadas têm saltos de ±2€ nos limites do 4.º e 8.º escalões (arredondamento oficial);
  // mantêm-se os valores oficiais e aceita-se essa diferença.
  it('IRS: a parcela a abater torna o imposto contínuo nos limites (±2€ da tabela oficial)', () => {
    for (let i = 1; i < IRS_BRACKETS_2026.length; i++) {
      const prev = IRS_BRACKETS_2026[i - 1];
      const cur = IRS_BRACKETS_2026[i];
      expect(Math.abs(cur.deduct - (prev.deduct + prev.limit * (cur.rate - prev.rate)))).toBeLessThanOrEqual(2.01);
    }
  });

  it('IRS: o imposto cresce com o rendimento e a taxa média fica abaixo de 53%', () => {
    let previous = 0;
    for (let income = 0; income <= 400000; income += 250) {
      const tax = calcIrsTotal(income);
      expect(tax).toBeGreaterThanOrEqual(previous - 1e-9);
      if (income > 0) expect(tax / income).toBeLessThan(0.53);
      previous = tax;
    }
  });

  it('IRS: taxa marginal entre escalões igual à taxa do escalão', () => {
    for (const b of IRS_BRACKETS_2026.slice(0, -1)) {
      expect(calcIrsBase(b.limit) - calcIrsBase(b.limit - 100)).toBeCloseTo(100 * b.rate, 6);
    }
  });

  it('solidariedade: contínua em 80.000€ e 250.000€', () => {
    expect(calcAdicionalSolidariedade(80000.01)).toBeCloseTo(0, 2);
    expect(calcAdicionalSolidariedade(250000.01) - calcAdicionalSolidariedade(250000)).toBeCloseTo(0, 2);
  });

  it('IRC: contínuo no limite PME e nunca acima da taxa geral', () => {
    for (const key of Object.keys(IRC_REGIMES) as RegimeIrc[]) {
      const { geral, pme } = IRC_REGIMES[key];
      expect(pme).toBeLessThanOrEqual(geral);
      expect(calcIrc(PME_THRESHOLD + 1, true, key) - calcIrc(PME_THRESHOLD, true, key)).toBeCloseTo(geral, 6);
      expect(calcIrc(123456, true, key)).toBeLessThanOrEqual(calcIrc(123456, false, key));
    }
  });
});

describe('Invariantes numa grelha de cenários', () => {
  const plans = [
    { anosLevantamento: 1, levantamentoAnual: 0 },
    { anosLevantamento: 5, levantamentoAnual: 0 },
    { anosLevantamento: 10, levantamentoAnual: 20000 },
    { anosLevantamento: 30, levantamentoAnual: 5000 },
  ];
  const cases: Inputs[] = [];
  for (const capitalPessoal of [0, 10000, 250000])
    for (const aporteAnual of [0, 5000])
      for (const retorno of [0, 0.035, 0.07, 0.15])
        for (const anos of [1, 2, 5, 8, 20])
          for (const plan of plans)
            for (const ircAnual of [false, true])
              for (const usarReduzida of [true, false])
                for (const regimeIrc of ['continente', 'madeira'] as RegimeIrc[])
                  for (const rendimentoBase of [0, 30000, 120000])
                    cases.push({ ...base, capitalPessoal, aporteAnual, retorno, anos, ...plan, ircAnual, usarReduzida, regimeIrc, rendimentoBase });

  const results: [Inputs, Results][] = cases.map((inp) => [inp, computeResults(inp)]);

  it(`corre ${cases.length} cenários sem NaN nem valores negativos`, () => {
    for (const [, r] of results) {
      for (const v of [r.liquidoPessoal, r.liquidoTransparencia, r.liquidoEmpresaDistribui, r.valorAposIrc, r.irsPessoal, r.irsTransparencia, r.ircEmpresaDistribui, r.dividendTax]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });

  it('todo o capital sai: bruto − ganho = capital investido', () => {
    for (const [inp, r] of results) {
      expect(r.brutoPessoal - r.ganhoPessoal).toBeCloseTo(inp.capitalPessoal + inp.aporteAnual * inp.anos, 4);
      expect(r.brutoEmpresa - r.ganhoEmpresa).toBeCloseTo(r.empresa.investido, 4);
    }
  });

  it('a soma do que o gráfico diz que se levanta é o valor bruto total', () => {
    for (const [, r] of results) {
      expect(sum(r.pathPessoal.map((p) => p.withdrawn))).toBeCloseTo(r.brutoPessoal, 4);
      expect(sum(r.pathEmpresa.map((p) => p.withdrawn))).toBeCloseTo(r.brutoEmpresa, 4);
      expect(r.pathPessoal).toHaveLength(r.pathEmpresa.length);
    }
  });

  it('mais-valias pessoais: entre 28% × 70% e 28% do ganho', () => {
    for (const [, r] of results) {
      expect(r.irsPessoal).toBeLessThanOrEqual(0.28 * r.ganhoPessoal + 1e-6);
      expect(r.irsPessoal).toBeGreaterThanOrEqual(0.28 * 0.7 * r.ganhoPessoal - 1e-6);
    }
  });

  it('transparência: IRS entre 0 e 53% do ganho', () => {
    for (const [, r] of results) {
      expect(r.irsTransparencia).toBeLessThanOrEqual(0.53 * r.ganhoPessoal + 1e-6);
    }
  });

  it('empresa: 28% sobre tudo o que sai depois do IRC', () => {
    for (const [, r] of results) {
      expect(r.dividendTax).toBeCloseTo((r.liquidoEmpresaDistribui * 0.28) / 0.72, 4);
    }
  });

  it('empresa: IRC entre a taxa mínima e a taxa geral sobre o ganho antes de impostos', () => {
    for (const [inp, r] of results) {
      const { geral, pme } = IRC_REGIMES[inp.regimeIrc];
      // com IRC anual o valor vendido já vem depois do IRC; na venda, o IRC sai do valor vendido
      const ganhoAntesIrc = r.brutoEmpresa - r.empresa.investido + (inp.ircAnual ? r.ircEmpresaDistribui : 0);
      expect(r.ircEmpresaDistribui).toBeLessThanOrEqual(geral * ganhoAntesIrc + 1e-6);
      expect(r.ircEmpresaDistribui).toBeGreaterThanOrEqual((inp.usarReduzida ? pme : geral) * ganhoAntesIrc - 1e-6);
    }
  });

  it('sem rentabilidade não há imposto sobre ganhos e a empresa devolve o mesmo que o pessoal', () => {
    for (const [inp, r] of results.filter(([i]) => i.retorno === 0)) {
      expect(r.irsPessoal).toBe(0);
      expect(r.irsTransparencia).toBe(0);
      expect(r.ircEmpresaDistribui).toBe(0);
      expect(r.liquidoPessoal).toBeCloseTo(inp.capitalPessoal + inp.aporteAnual * inp.anos, 4);
      // o capital da empresa é arredondado ao euro: diferença máxima de 0,72 × 0,5€ por entrada
      expect(Math.abs(r.liquidoEmpresaDistribui - r.liquidoPessoal)).toBeLessThanOrEqual(0.36 * (inp.anos + 1));
    }
  });

  it('mais rentabilidade dá sempre mais dinheiro no bolso', () => {
    const key = (i: Inputs) => JSON.stringify({ ...i, retorno: 0 });
    const groups = new Map<string, [Inputs, Results][]>();
    for (const entry of results) groups.set(key(entry[0]), [...(groups.get(key(entry[0])) ?? []), entry]);
    for (const group of groups.values()) {
      const sorted = group.sort((a, b) => a[0].retorno - b[0].retorno);
      for (let i = 1; i < sorted.length; i++) {
        const [prev, cur] = [sorted[i - 1][1], sorted[i][1]];
        expect(cur.liquidoPessoal).toBeGreaterThanOrEqual(prev.liquidoPessoal - 1e-6);
        expect(cur.liquidoTransparencia).toBeGreaterThanOrEqual(prev.liquidoTransparencia - 1e-6);
        expect(cur.liquidoEmpresaDistribui).toBeGreaterThanOrEqual(prev.liquidoEmpresaDistribui - 1e-6);
      }
    }
  });

  it('um valor anual maior do que a carteira equivale a tirar tudo de uma vez', () => {
    for (const [inp, r] of results.filter(([i]) => i.anosLevantamento === 1)) {
      const tudo = computeResults({ ...inp, anosLevantamento: 7, levantamentoAnual: 1e12 });
      expect(tudo.liquidoPessoal).toBeCloseTo(r.liquidoPessoal, 4);
      expect(tudo.liquidoTransparencia).toBeCloseTo(r.liquidoTransparencia, 4);
      expect(tudo.liquidoEmpresaDistribui).toBeCloseTo(r.liquidoEmpresaDistribui, 4);
    }
  });

  it('regiões e PME: taxas mais baixas nunca pagam mais IRC', () => {
    for (const inp of cases.filter((i) => i.regimeIrc === 'continente' && i.retorno > 0).slice(0, 400)) {
      const irc = (regimeIrc: RegimeIrc, usarReduzida = inp.usarReduzida) =>
        computeResults({ ...inp, regimeIrc, usarReduzida }).ircEmpresaDistribui;
      expect(irc('acores')).toBeLessThanOrEqual(irc('madeira') + 1e-6);
      expect(irc('madeira')).toBeLessThanOrEqual(irc('continente') + 1e-6);
      expect(irc('interior')).toBeLessThanOrEqual(irc('continente') + 1e-6);
      expect(irc('continente', true)).toBeLessThanOrEqual(irc('continente', false) + 1e-6);
    }
  });
});

describe('Cenários calculados à mão', () => {
  it('100.000€ a 5% durante 3 anos, rendimento de 30.000€, Continente PME, IRC na venda', () => {
    const r = computeResults(base);

    // pessoal: 100.000 × 1,05³ = 115.762,50; ganho 15.762,50 com −10% (3 anos) a 28%
    expect(r.liquidoPessoal).toBeCloseTo(115762.5 - 15762.5 * 0.9 * 0.28, 2);

    // transparência: coletável = 30.000 − 4.587,0902 = 25.412,9098 (5.º escalão); com o ganho passa ao 6.º
    const coletavel = 30000 - 8.54 * 537.13;
    const irs = (coletavel + 15762.5) * 0.349 - 4207.85 - (coletavel * 0.311 - 3090.76);
    expect(r.irsTransparencia).toBeCloseTo(irs, 2);

    // empresa: 138.889 × 1,05³; IRC 15% sobre o ganho (< 50.000€); 28% sobre o que sai
    const valorEmpresa = 138889 * 1.05 ** 3;
    const ircEmpresa = (valorEmpresa - 138889) * 0.15;
    expect(r.ircEmpresaDistribui).toBeCloseTo(ircEmpresa, 2);
    expect(r.liquidoEmpresaDistribui).toBeCloseTo((valorEmpresa - ircEmpresa) * 0.72, 2);
  });

  it('IRC anual acima de 50.000€ de lucro: taxa PME só nos primeiros 50.000€ de cada ano', () => {
    const r = computeResults({
      ...base,
      retorno: 0.1,
      anos: 2,
      ircAnual: true,
      customCapitalEmpresa: true,
      capitalEmpresaCustom: 1_000_000,
    });
    // ano 1: ganho 100.000 → IRC 7.500 + 9.500 = 17.000 → 1.083.000
    // ano 2: ganho 108.300 → IRC 7.500 + 58.300 × 19% = 18.577 → 1.172.723
    expect(r.ircEmpresaDistribui).toBeCloseTo(17000 + 18577, 2);
    expect(r.liquidoEmpresaDistribui).toBeCloseTo(1_172_723 * 0.72, 2);
  });

  it('transparência acima de 250.000€: 48% + 5% de solidariedade sobre o ganho', () => {
    const r = computeResults({ ...base, rendimentoBase: 300000, retorno: 0.1, anos: 1 });
    // coletável = 300.000 × 0,89 = 267.000; o ganho de 10.000€ paga 48% + 5%
    expect(r.irsTransparencia).toBeCloseTo(10000 * 0.53, 2);
  });

  it('reforços anuais: cada um com o desconto do seu prazo', () => {
    const r = computeResults({ ...base, capitalPessoal: 0, aporteAnual: 1000, retorno: 0.1, anos: 8 });
    // o reforço do ano k fica 9 − k anos: prazos 8, 7, 6, 5, 4, 3, 2 e 1
    const desconto = [0, 0, 0.1, 0.1, 0.1, 0.2, 0.2, 0.2, 0.3];
    let tributavel = 0;
    for (let h = 1; h <= 8; h++) tributavel += 1000 * (1.1 ** h - 1) * (1 - desconto[h]);
    expect(r.irsPessoal).toBeCloseTo(tributavel * 0.28, 2);
  });

  it('valor fixo sem rentabilidade: 30.000€/ano de 100.000€ acaba no 4.º ano', () => {
    const r = computeResults({
      ...base,
      retorno: 0,
      customCapitalEmpresa: true,
      capitalEmpresaCustom: 100000,
      anosLevantamento: 10,
      levantamentoAnual: 30000,
    });
    expect(r.pathEmpresa.slice(3).map((p) => p.withdrawn)).toEqual([30000, 30000, 30000, 10000]);
    expect(r.pathEmpresa.at(-1)!.value).toBe(0);
    expect(r.liquidoEmpresaDistribui).toBeCloseTo(72000, 6);
  });

  it('partes iguais: 3 anos a 10% vendem 1/3, 1/2 e o resto', () => {
    const r = computeResults({ ...base, capitalPessoal: 90000, retorno: 0.1, anos: 1, anosLevantamento: 3, rendimentoBase: 0 });
    const v0 = 99000;
    const s0 = v0 / 3;
    const s1 = ((v0 - s0) * 1.1) / 2;
    const s2 = (v0 - s0) * 1.1 - s1;
    const s2grown = s2 * 1.1;
    expect(r.pathPessoal.slice(1).map((p) => p.withdrawn)).toEqual([
      expect.closeTo(s0, 6),
      expect.closeTo(s1, 6),
      expect.closeTo(s2grown, 6),
    ]);
  });
});
