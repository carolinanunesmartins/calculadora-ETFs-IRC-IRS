import { calcIrc, type RegimeIrc } from './irc';

// `withdrawn`: valor bruto levantado nesse ano (só nos anos de levantamento).
export type PathPoint = { year: number; invested: number; value: number; withdrawn?: number };

export type Projection = {
  path: PathPoint[];
  valorFinal: number;
  investido: number;
  ircAcumulado: number;
};

export type AnnualIrc = { usarReduzida: boolean; regimeIrc: RegimeIrc };

// Reforço entra no início de cada ano; com `annualIrc` o IRC sai do ganho de cada ano.
export function projectPath(
  capitalInicial: number,
  aporteAnual: number,
  retorno: number,
  anos: number,
  annualIrc?: AnnualIrc,
): Projection {
  let valor = capitalInicial;
  let investido = capitalInicial;
  let ircAcumulado = 0;
  const path: PathPoint[] = [{ year: 0, invested: investido, value: valor }];

  for (let year = 1; year <= anos; year++) {
    valor += aporteAnual;
    investido += aporteAnual;
    const ganhoAno = valor * retorno;
    valor += ganhoAno;

    if (annualIrc) {
      const ircAno = calcIrc(ganhoAno, annualIrc.usarReduzida, annualIrc.regimeIrc);
      valor -= ircAno;
      ircAcumulado += ircAno;
    }

    path.push({ year, invested: investido, value: valor });
  }

  return { path, valorFinal: valor, investido, ircAcumulado };
}
