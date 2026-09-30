# Calculadora ETFs — IRS vs IRC

Simulador (regras fiscais 2026) que compara quanto fica no bolso ao investir em ETFs de três formas:

- **Investimento pessoal:** mais-valias a 28%, com desconto por antiguidade (2/5/8 anos).
- **Transparência fiscal:** o ganho soma-se ao rendimento e paga IRS pelos escalões de 2026 + taxa adicional de solidariedade.
- **Empresa normal:** IRC por região (Continente, Interior, Açores, Madeira) com taxa PME até 50.000€, IRC na venda ou anual, e 28% ao distribuir.

Assistente de 11 perguntas → dashboard editável, gráfico e cenários guardados (localStorage).

## Comandos

```bash
npm install
npm run dev     # servidor local
npm test        # testes (Vitest)
npm run build   # build de produção
```

## Estrutura

- `src/tax/` — lógica fiscal pura (irs, irc, projection, withdrawal, results) + testes
- `src/ui/` — DOM, gráfico SVG, assistente, cenários
- `src/main.ts` — ligação da UI; `src/styles.css` — estilos

Ferramenta educativa — não substitui um contabilista.
