export const DIVIDEND_TAX = 0.28;
export const PME_THRESHOLD = 50000;
export const MICRO_ENTITY_BALANCE_LIMIT = 450000;

export type RegimeIrc = 'continente' | 'interior' | 'acores' | 'madeira';

export const IRC_REGIMES: Record<RegimeIrc, { label: string; geral: number; pme: number }> = {
  continente: { label: 'Continente', geral: 0.19, pme: 0.15 },
  interior: { label: 'Continente — Interior', geral: 0.19, pme: 0.125 },
  acores: { label: 'Açores', geral: 0.14, pme: 0.0875 },
  madeira: { label: 'Madeira', geral: 0.133, pme: 0.105 },
};

export function calcIrc(lucro: number, usarReduzida: boolean, regimeKey: RegimeIrc): number {
  if (lucro <= 0) return 0;
  const regime = IRC_REGIMES[regimeKey] ?? IRC_REGIMES.continente;
  if (!usarReduzida) return lucro * regime.geral;
  const base1 = Math.min(lucro, PME_THRESHOLD);
  const base2 = Math.max(0, lucro - PME_THRESHOLD);
  return base1 * regime.pme + base2 * regime.geral;
}
