import { describe, expect, it } from 'vitest';
import { bestRow, computeResults, grossUpForDividends, personaRows, sanitizeInputs, type Inputs } from './results';

const base: Inputs = {
  capitalPessoal: 100000,
  aporteAnual: 0,
  retorno: 0.1,
  anos: 1,
  rendimentoBase: 20000,
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

describe('grossUpForDividends', () => {
  it('devolve o bruto que, após 28%, dá o líquido', () => {
    expect(grossUpForDividends(72000)).toBe(100000);
  });
});

describe('computeResults', () => {
  const r = computeResults(base);

  it('investimento pessoal paga 28% sobre o ganho', () => {
    expect(r.ganhoPessoal).toBeCloseTo(10000);
    expect(r.irsPessoal).toBeCloseTo(2800);
    expect(r.liquidoPessoal).toBeCloseTo(107200);
  });

  it('transparência fiscal paga o IRS marginal sobre o ganho', () => {
    // coletável = 20.000€ − dedução específica (8,54 × 537,13€)
    const coletavel = 20000 - 8.54 * 537.13;
    const esperado = (coletavel + 10000) * 0.311 - 3090.76 - (coletavel * 0.212 - 959.23);
    expect(r.irsTransparencia).toBeCloseTo(esperado);
    expect(r.liquidoTransparencia).toBeCloseTo(110000 - esperado);
  });

  it('empresa parte do capital bruto e paga IRC + 28% sobre o que sai', () => {
    expect(r.capitalEmpresa).toBe(138889);
    expect(r.ircEmpresa).toBeCloseTo(2083.34, 1);
    expect(r.valorAposIrc).toBeCloseTo(150694.57, 1);
    expect(r.liquidoEmpresaDistribui).toBeCloseTo(108500.09, 1);
  });

  it('aplica desconto por antiguidade no investimento pessoal', () => {
    const r8 = computeResults({ ...base, anos: 8 });
    expect(r8.desconto).toBe(0.3);
    expect(r8.irsPessoal).toBeCloseTo(r8.ganhoPessoal * 0.28 * 0.7);
  });

  it('reforços tardios não herdam o desconto do prazo total', () => {
    const rr = computeResults({ ...base, capitalPessoal: 0, aporteAnual: 1000, anos: 2 });
    expect(rr.irsPessoal).toBeCloseTo((210 * 0.9 + 100) * 0.28);
  });

  it('a linha "tira tudo" paga sempre os 28%, mesmo com "fica na empresa"', () => {
    const rm = computeResults({ ...base, distribui: false });
    expect(rm.dividendTax).toBeCloseTo(rm.valorAposIrc * 0.28);
    expect(rm.liquidoEmpresaDistribui).toBeCloseTo(r.liquidoEmpresaDistribui);
  });

  it('levantamento faseado: soma o que sai em cada ano, com os impostos de cada ano', () => {
    const rf = computeResults({ ...base, anosLevantamento: 3 });
    const rows = personaRows(rf);
    const pessoal = rows.find((x) => x.key === 'pessoal')!;
    const empresa = rows.find((x) => x.key === 'empresaDistribui')!;
    expect(pessoal.bruto).toBeGreaterThan(r.pessoal.valorFinal);
    expect(pessoal.liquido).toBeCloseTo(pessoal.bruto - rf.irsPessoal);
    expect(empresa.imposto).toBeCloseTo(rf.ircEmpresaDistribui + rf.dividendTax);
    expect(empresa.liquido).toBeCloseTo(empresa.bruto - empresa.imposto);
  });

  it('o gráfico continua pelos anos de levantamento', () => {
    const rf = computeResults({ ...base, anos: 5, anosLevantamento: 4 });
    expect(rf.pathPessoal).toHaveLength(5 + 4);
    expect(rf.pathEmpresa).toHaveLength(5 + 4);
    expect(rf.pathPessoal.at(-1)).toMatchObject({ year: 8, invested: 0, value: 0 });
    expect(r.pathPessoal.map(({ withdrawn: _w, ...p }) => p)).toEqual(r.pessoal.path);
  });

  it('valor fixo: o gráfico acaba quando o dinheiro acaba nas duas carteiras', () => {
    const rf = computeResults({ ...base, anos: 5, anosLevantamento: 30, levantamentoAnual: 60000 });
    expect(rf.pathPessoal.length).toBeLessThan(5 + 30);
    expect(rf.pathPessoal).toHaveLength(rf.pathEmpresa.length);
    expect(rf.pathPessoal.at(-1)!.value).toBe(0);
    expect(rf.pathEmpresa.at(-1)!.value).toBe(0);
    expect(rf.pathEmpresa.at(-2)!.value).toBeGreaterThan(0);
  });

  it('os pontos do gráfico dizem quanto se levanta nesse ano', () => {
    const rf = computeResults({ ...base, anos: 5, anosLevantamento: 3, levantamentoAnual: 20000 });
    expect(rf.pathPessoal[4].withdrawn).toBeUndefined();
    expect(rf.pathPessoal[5].withdrawn).toBeCloseTo(20000);
    expect(rf.pathEmpresa[6].withdrawn).toBeCloseTo(20000);
    expect(rf.pathPessoal[7].withdrawn).toBeCloseTo(rf.brutoPessoal - 40000);
  });

  it('os reforços param quando começa o levantamento, qualquer que seja o plano', () => {
    const comReforco = { ...base, aporteAnual: 5000, anos: 10 };
    for (const plano of [{ anosLevantamento: 1, levantamentoAnual: 0 }, { anosLevantamento: 45, levantamentoAnual: 0 }, { anosLevantamento: 60, levantamentoAnual: 12000 }]) {
      const rf = computeResults({ ...comReforco, ...plano });
      // capital investido = inicial + 10 reforços; o capital no gráfico nunca sobe depois do ano 10
      expect(rf.brutoPessoal - rf.ganhoPessoal).toBeCloseTo(100000 + 10 * 5000, 4);
      const capital = rf.pathPessoal.slice(10).map((p) => p.invested);
      capital.slice(1).forEach((c, i) => expect(c).toBeLessThanOrEqual(capital[i] + 1e-9));
    }
  });

  it('levantamento faseado não muda a linha "fica na empresa"', () => {
    const rf = computeResults({ ...base, anosLevantamento: 3 });
    expect(rf.valorAposIrc).toBeCloseTo(r.valorAposIrc);
    expect(rf.ircEmpresa).toBeCloseTo(r.ircEmpresa);
  });

  it('usa o capital personalizado da empresa quando pedido', () => {
    const rc = computeResults({ ...base, customCapitalEmpresa: true, capitalEmpresaCustom: 50000, aporteAnualEmpresaCustom: 1000 });
    expect(rc.capitalEmpresa).toBe(50000);
    expect(rc.aporteAnualEmpresa).toBe(1000);
  });
});

describe('bestRow', () => {
  it('ignora a linha "fica na empresa"', () => {
    const rows = personaRows(computeResults(base));
    expect(bestRow(rows).key).toBe('empresaDistribui');
    expect(rows.find((x) => x.key === 'empresaMantem')!.liquido).toBeGreaterThan(bestRow(rows).liquido);
  });
});

describe('sanitizeInputs', () => {
  it('limita valores fora dos intervalos permitidos', () => {
    const s = sanitizeInputs({
      ...base,
      capitalPessoal: -1000,
      aporteAnual: -5,
      retorno: 5,
      anos: -3,
      rendimentoBase: -1,
      capitalEmpresaCustom: -10,
      aporteAnualEmpresaCustom: -10,
      levantamentoAnual: -100,
    });
    expect(s).toMatchObject({
      capitalPessoal: 0,
      aporteAnual: 0,
      retorno: 0.3,
      anos: 1,
      rendimentoBase: 0,
      capitalEmpresaCustom: 0,
      aporteAnualEmpresaCustom: 0,
      levantamentoAnual: 0,
    });
    expect(sanitizeInputs({ ...base, anos: 60, anosLevantamento: 45 })).toMatchObject({ anos: 60, anosLevantamento: 45 });
    expect(sanitizeInputs({ ...base, anos: 150, retorno: -0.2, anosLevantamento: 150 })).toMatchObject({
      anos: 100,
      retorno: 0,
      anosLevantamento: 100,
    });
  });

  it('converte anos fracionários e valores não finitos', () => {
    expect(sanitizeInputs({ ...base, anos: 2.7, capitalPessoal: Infinity, aporteAnual: NaN })).toMatchObject({
      anos: 2,
      capitalPessoal: 0,
      aporteAnual: 0,
    });
  });

  it('cenários antigos sem levantamento faseado ficam com 1 ano e sem valor fixo', () => {
    const { anosLevantamento: _omitAnos, levantamentoAnual: _omitValor, ...antigo } = base;
    expect(sanitizeInputs(antigo as Inputs)).toMatchObject({ anosLevantamento: 1, levantamentoAnual: 0 });
  });

  it('arredonda a rentabilidade a 2 casas decimais (em %)', () => {
    expect(sanitizeInputs({ ...base, retorno: 0.07 * 1.0000000001 }).retorno).toBe(0.07);
    expect(sanitizeInputs({ ...base, retorno: 0.072561 }).retorno).toBe(0.0726);
  });

  it('mantém valores válidos', () => {
    expect(sanitizeInputs(base)).toEqual(base);
  });
});
