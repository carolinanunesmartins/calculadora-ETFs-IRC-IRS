import type { Inputs } from '../tax/results';

// Mesma chave da versão anterior para não perder cenários já guardados.
const STORAGE_KEY = 'simulador-irs-2026-scenarios';

export type Scenario = { id: number; name: string; inputs: Inputs };

export function loadScenarios(): Scenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Scenario[]) : [];
  } catch {
    return [];
  }
}

export function saveScenarios(list: Scenario[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage indisponível (modo privado, bloqueado)
  }
}
