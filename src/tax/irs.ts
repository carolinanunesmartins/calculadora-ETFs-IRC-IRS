export const CAPITAL_GAINS_TAX = 0.28;
export const IAS_2026 = 537.13;
const SOCIAL_SECURITY_RATE = 0.11;

export const IRS_BRACKETS_2026 = [
  { limit: 8342, rate: 0.125, deduct: 0 },
  { limit: 12587, rate: 0.157, deduct: 266.94 },
  { limit: 17838, rate: 0.212, deduct: 959.23 },
  { limit: 23089, rate: 0.241, deduct: 1474.53 },
  { limit: 29397, rate: 0.311, deduct: 3090.76 },
  { limit: 43090, rate: 0.349, deduct: 4207.85 },
  { limit: 46566, rate: 0.431, deduct: 7741.23 },
  { limit: 86634, rate: 0.446, deduct: 8441.72 },
  { limit: Infinity, rate: 0.48, deduct: 11387.28 },
] as const;

export function calcIrsBase(taxable: number): number {
  if (taxable <= 0) return 0;
  const bracket = IRS_BRACKETS_2026.find((b) => taxable <= b.limit)!;
  return Math.max(0, taxable * bracket.rate - bracket.deduct);
}

export function calcAdicionalSolidariedade(taxable: number): number {
  if (taxable <= 80000) return 0;
  if (taxable <= 250000) return (taxable - 80000) * 0.025;
  return (250000 - 80000) * 0.025 + (taxable - 250000) * 0.05;
}

export function calcIrsTotal(taxable: number): number {
  return calcIrsBase(taxable) + calcAdicionalSolidariedade(taxable);
}

export function antiguidadeDesconto(anos: number): number {
  if (anos >= 8) return 0.3;
  if (anos >= 5) return 0.2;
  if (anos >= 2) return 0.1;
  return 0;
}

// Dedução específica da categoria A (art. 25.º CIRS): o maior entre 8,54 × IAS e as contribuições para a Segurança Social.
export function calcRendimentoColetavel(bruto: number): number {
  const deducao = Math.max(8.54 * IAS_2026, bruto * SOCIAL_SECURITY_RATE);
  return Math.max(0, bruto - deducao);
}
