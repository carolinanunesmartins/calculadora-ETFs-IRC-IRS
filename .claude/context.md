# calculadora-ETFs-IRC-IRS — contexto

Vite + TypeScript (vanilla) + Vitest. Sem Tailwind (CSS próprio em src/styles.css). SPA estática.

- Lógica fiscal pura em `src/tax/`: irs.ts (escalões 2026, solidariedade, antiguidade), irc.ts (regimes regionais, PME 50k), projection.ts, results.ts (computeResults, personaRows, bestRow).
- UI em `src/ui/` (dom, chart, wizard, scenarios) + `src/main.ts`.
- Cenários em localStorage com a chave `simulador-irs-2026-scenarios` (compatível com a versão app.js original).
- Versão anterior (calculadora IRS vs IRC simples com Tailwind) em `.bak/2026-09-29/` (gitignored).
