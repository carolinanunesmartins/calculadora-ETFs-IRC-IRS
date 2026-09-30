import { calcIrc, DIVIDEND_TAX, type RegimeIrc } from './irc';
import { antiguidadeDesconto, calcIrsTotal, CAPITAL_GAINS_TAX } from './irs';
import type { PathPoint } from './projection';

// Levantamento ao longo de no máximo `plano.anos` anos (j = 0 é o fim do prazo); o que fica continua a render.
// Sem `valorAnual`, vende-se 1/(N − j) do que resta; com `valorAnual`, vende-se esse valor bruto e, no último ano, o resto.
// Cada venda sai de todas as tranches na mesma proporção.
// `path` guarda o que fica investido depois de cada venda a partir de j = 1, com `year` = j; `saques[j]` é o valor bruto vendido no ano j.

type Tranche = { cost: number; value: number; held: number };

export type PersonalWithdrawal = {
  bruto: number;
  ganho: number;
  irsPessoal: number;
  irsTransparencia: number;
  path: PathPoint[];
  saques: number[];
};

export type CompanyWithdrawal = {
  bruto: number;
  ganho: number;
  irc: number;
  dividendTax: number;
  liquido: number;
  path: PathPoint[];
  saques: number[];
};

export type WithdrawalPlan = { anos: number; valorAnual: number };

function saleFraction(plano: WithdrawalPlan, j: number, valorAtual: number): number {
  if (j === plano.anos - 1 || plano.valorAnual <= 0) return 1 / (plano.anos - j);
  return valorAtual > 0 ? Math.min(1, plano.valorAnual / valorAtual) : 0;
}

export type CompanyIrc = { usarReduzida: boolean; regimeIrc: RegimeIrc; anual: boolean };

// O capital inicial fica `anos`; o reforço do ano k entra no início desse ano e fica `anos - k + 1`.
function personalTranches(capitalInicial: number, aporteAnual: number, retorno: number, anos: number): Tranche[] {
  const tranches = [{ cost: capitalInicial, value: capitalInicial * (1 + retorno) ** anos, held: anos }];
  for (let k = 1; k <= anos; k++) {
    const held = anos - k + 1;
    tranches.push({ cost: aporteAnual, value: aporteAnual * (1 + retorno) ** held, held });
  }
  return tranches;
}

export function withdrawPersonal(
  capitalInicial: number,
  aporteAnual: number,
  retorno: number,
  anos: number,
  plano: WithdrawalPlan,
  coletavel: number,
): PersonalWithdrawal {
  const tranches = personalTranches(capitalInicial, aporteAnual, retorno, anos);
  const out: PersonalWithdrawal = { bruto: 0, ganho: 0, irsPessoal: 0, irsTransparencia: 0, path: [], saques: [] };

  for (let j = 0; j < plano.anos; j++) {
    if (j > 0) {
      for (const t of tranches) {
        t.value *= 1 + retorno;
        t.held++;
      }
    }
    const fraction = saleFraction(plano, j, tranches.reduce((sum, t) => sum + t.value, 0));
    let ganhoAno = 0;
    let tributavelAno = 0;
    let vendidoAno = 0;
    for (const t of tranches) {
      const vendido = t.value * fraction;
      const custo = t.cost * fraction;
      vendidoAno += vendido;
      ganhoAno += vendido - custo;
      tributavelAno += (vendido - custo) * (1 - antiguidadeDesconto(t.held));
      t.value -= vendido;
      t.cost -= custo;
    }
    out.bruto += vendidoAno;
    out.saques.push(vendidoAno);
    out.ganho += ganhoAno;
    out.irsPessoal += Math.max(0, tributavelAno) * CAPITAL_GAINS_TAX;
    out.irsTransparencia += calcIrsTotal(coletavel + Math.max(0, ganhoAno)) - calcIrsTotal(coletavel);
    if (j > 0) {
      out.path.push({
        year: j,
        invested: tranches.reduce((sum, t) => sum + t.cost, 0),
        value: tranches.reduce((sum, t) => sum + t.value, 0),
      });
    }
  }
  return out;
}

// Com `anual`, o ganho já pagou IRC ano a ano e a venda só paga os 28% ao sair.
export function withdrawCompany(
  valor: number,
  custo: number,
  retorno: number,
  plano: WithdrawalPlan,
  irc: CompanyIrc,
): CompanyWithdrawal {
  const out: CompanyWithdrawal = { bruto: 0, ganho: 0, irc: 0, dividendTax: 0, liquido: 0, path: [], saques: [] };

  for (let j = 0; j < plano.anos; j++) {
    if (j > 0) {
      const ganhoAno = valor * retorno;
      valor += ganhoAno;
      if (irc.anual) {
        const ircAno = calcIrc(ganhoAno, irc.usarReduzida, irc.regimeIrc);
        valor -= ircAno;
        out.irc += ircAno;
      }
    }
    const fraction = saleFraction(plano, j, valor);
    const vendido = valor * fraction;
    const custoVendido = custo * fraction;
    const ircVenda = irc.anual ? 0 : calcIrc(vendido - custoVendido, irc.usarReduzida, irc.regimeIrc);
    const dividendTax = (vendido - ircVenda) * DIVIDEND_TAX;

    out.bruto += vendido;
    out.saques.push(vendido);
    out.ganho += vendido - custoVendido;
    out.irc += ircVenda;
    out.dividendTax += dividendTax;
    out.liquido += vendido - ircVenda - dividendTax;
    valor -= vendido;
    custo -= custoVendido;
    if (j > 0) out.path.push({ year: j, invested: custo, value: valor });
  }
  return out;
}
