import { calcIrc, DIVIDEND_TAX, type RegimeIrc } from './irc';
import { antiguidadeDesconto, calcRendimentoColetavel } from './irs';
import { projectPath, type PathPoint, type Projection } from './projection';
import { withdrawCompany, withdrawPersonal } from './withdrawal';

export type Inputs = {
  capitalPessoal: number;
  aporteAnual: number;
  retorno: number;
  anos: number;
  rendimentoBase: number;
  regimeIrc: RegimeIrc;
  usarReduzida: boolean;
  ircAnual: boolean;
  distribui: boolean;
  customCapitalEmpresa: boolean;
  capitalEmpresaCustom: number;
  aporteAnualEmpresaCustom: number;
  anosLevantamento: number;
  levantamentoAnual: number;
};

export type Results = {
  desconto: number;
  capitalEmpresa: number;
  aporteAnualEmpresa: number;
  pessoal: Projection;
  empresa: Projection;
  pathPessoal: PathPoint[];
  pathEmpresa: PathPoint[];
  brutoPessoal: number;
  ganhoPessoal: number;
  irsPessoal: number;
  liquidoPessoal: number;
  irsTransparencia: number;
  liquidoTransparencia: number;
  ircEmpresa: number;
  valorAposIrc: number;
  brutoEmpresa: number;
  ganhoEmpresa: number;
  ircEmpresaDistribui: number;
  dividendTax: number;
  liquidoEmpresaDistribui: number;
};

export type RowKey = 'pessoal' | 'transparencia' | 'empresaDistribui' | 'empresaMantem';

export type PersonaRow = {
  key: RowKey;
  tag: string;
  cls: 'personal' | 'company';
  title: string;
  desc: string;
  bruto: number;
  ganho: number;
  imposto: number;
  liquido: number;
};

// Valor bruto que, depois de 28% de dividendos, equivale ao montante pessoal.
export const grossUpForDividends = (net: number): number => Math.round(net / (1 - DIVIDEND_TAX));

export const INPUT_LIMITS = { retornoMax: 0.3, anosMin: 1, anosMax: 40, levantamentoMax: 30 } as const;

const clamp = (value: number, min: number, max = Infinity): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

export function sanitizeInputs(inp: Inputs): Inputs {
  return {
    ...inp,
    capitalPessoal: clamp(inp.capitalPessoal, 0),
    aporteAnual: clamp(inp.aporteAnual, 0),
    retorno: Math.round(clamp(inp.retorno, 0, INPUT_LIMITS.retornoMax) * 10000) / 10000,
    anos: Math.trunc(clamp(inp.anos, INPUT_LIMITS.anosMin, INPUT_LIMITS.anosMax)),
    rendimentoBase: clamp(inp.rendimentoBase, 0),
    capitalEmpresaCustom: clamp(inp.capitalEmpresaCustom, 0),
    aporteAnualEmpresaCustom: clamp(inp.aporteAnualEmpresaCustom, 0),
    anosLevantamento: Math.trunc(clamp(inp.anosLevantamento, 1, INPUT_LIMITS.levantamentoMax)),
    levantamentoAnual: clamp(inp.levantamentoAnual, 0),
  };
}

// Os pontos do levantamento vêm com `year` relativo ao fim do prazo; o 1.º levantamento é no último ponto da acumulação.
const joinPath = (acumulacao: PathPoint[], levantamento: PathPoint[], saques: number[], anos: number): PathPoint[] => [
  ...acumulacao.slice(0, -1),
  { ...acumulacao[acumulacao.length - 1], withdrawn: saques[0] },
  ...levantamento.map((p) => ({ ...p, year: anos + p.year, withdrawn: saques[p.year] })),
];

// Com valor fixo o dinheiro pode acabar antes do limite: corta os anos em que as duas carteiras já estão vazias.
function trimEmptyTail(a: PathPoint[], b: PathPoint[], minLength: number): [PathPoint[], PathPoint[]] {
  let end = a.length;
  while (end > minLength && a[end - 2].value === 0 && b[end - 2].value === 0) end--;
  return [a.slice(0, end), b.slice(0, end)];
}

export function computeResults(inp: Inputs): Results {
  const plano = { anos: inp.anosLevantamento, valorAnual: inp.levantamentoAnual };
  const desconto = antiguidadeDesconto(inp.anos);
  const capitalEmpresa = inp.customCapitalEmpresa ? inp.capitalEmpresaCustom : grossUpForDividends(inp.capitalPessoal);
  const aporteAnualEmpresa = inp.customCapitalEmpresa ? inp.aporteAnualEmpresaCustom : grossUpForDividends(inp.aporteAnual);

  const pessoal = projectPath(inp.capitalPessoal, inp.aporteAnual, inp.retorno, inp.anos);
  const saidaPessoal = withdrawPersonal(
    inp.capitalPessoal,
    inp.aporteAnual,
    inp.retorno,
    inp.anos,
    plano,
    calcRendimentoColetavel(inp.rendimentoBase),
  );
  const liquidoPessoal = saidaPessoal.bruto - saidaPessoal.irsPessoal;
  const liquidoTransparencia = saidaPessoal.bruto - saidaPessoal.irsTransparencia;

  const empresa = projectPath(
    capitalEmpresa,
    aporteAnualEmpresa,
    inp.retorno,
    inp.anos,
    inp.ircAnual ? { usarReduzida: inp.usarReduzida, regimeIrc: inp.regimeIrc } : undefined,
  );
  let ircEmpresa = empresa.ircAcumulado;
  let valorAposIrc = empresa.valorFinal;

  if (!inp.ircAnual) {
    const ganhoEmpresa = empresa.valorFinal - empresa.investido;
    ircEmpresa = calcIrc(Math.max(0, ganhoEmpresa), inp.usarReduzida, inp.regimeIrc);
    valorAposIrc = empresa.valorFinal - ircEmpresa;
  }

  const saidaEmpresa = withdrawCompany(empresa.valorFinal, empresa.investido, inp.retorno, plano, {
    usarReduzida: inp.usarReduzida,
    regimeIrc: inp.regimeIrc,
    anual: inp.ircAnual,
  });

  const [pathPessoal, pathEmpresa] = trimEmptyTail(
    joinPath(pessoal.path, saidaPessoal.path, saidaPessoal.saques, inp.anos),
    joinPath(empresa.path, saidaEmpresa.path, saidaEmpresa.saques, inp.anos),
    inp.anos + 2,
  );

  return {
    desconto,
    capitalEmpresa,
    aporteAnualEmpresa,
    pessoal,
    empresa,
    pathPessoal,
    pathEmpresa,
    brutoPessoal: saidaPessoal.bruto,
    ganhoPessoal: saidaPessoal.ganho,
    irsPessoal: saidaPessoal.irsPessoal,
    liquidoPessoal,
    irsTransparencia: saidaPessoal.irsTransparencia,
    liquidoTransparencia,
    ircEmpresa,
    valorAposIrc,
    brutoEmpresa: saidaEmpresa.bruto,
    ganhoEmpresa: saidaEmpresa.ganho,
    ircEmpresaDistribui: empresa.ircAcumulado + saidaEmpresa.irc,
    dividendTax: saidaEmpresa.dividendTax,
    liquidoEmpresaDistribui: saidaEmpresa.liquido,
  };
}

export function personaRows(r: Results): PersonaRow[] {
  const ganhoEmpresa = r.empresa.valorFinal - r.empresa.investido;
  return [
    { key: 'pessoal', tag: 'P', cls: 'personal', title: 'Investimento pessoal', desc: 'Investe a título pessoal e vende', bruto: r.brutoPessoal, ganho: r.ganhoPessoal, imposto: r.irsPessoal, liquido: r.liquidoPessoal },
    { key: 'transparencia', tag: 'T', cls: 'personal', title: 'Transparência fiscal', desc: 'Ganho tributado no teu IRS', bruto: r.brutoPessoal, ganho: r.ganhoPessoal, imposto: r.irsTransparencia, liquido: r.liquidoTransparencia },
    { key: 'empresaDistribui', tag: 'E', cls: 'company', title: 'Empresa normal', desc: 'Tira tudo como dividendos', bruto: r.brutoEmpresa, ganho: r.ganhoEmpresa, imposto: r.ircEmpresaDistribui + r.dividendTax, liquido: r.liquidoEmpresaDistribui },
    { key: 'empresaMantem', tag: 'E', cls: 'company', title: 'Empresa normal', desc: 'Fica na empresa — ainda não está no teu bolso', bruto: r.empresa.valorFinal, ganho: ganhoEmpresa, imposto: r.ircEmpresa, liquido: r.valorAposIrc },
  ];
}

// "Fica na empresa" não conta: o dinheiro ainda não está no bolso do sócio.
export function bestRow(rows: PersonaRow[]): PersonaRow {
  return rows.filter((x) => x.key !== 'empresaMantem').reduce((a, b) => (b.liquido > a.liquido ? b : a));
}
