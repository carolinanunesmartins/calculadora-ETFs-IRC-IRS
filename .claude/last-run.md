# Última sessão — 2026-09-30

Sem commits. 70/70 testes, build limpo, npm audit 0 vulnerabilidades.
- Levantamento faseado (`src/tax/withdrawal.ts`): campo "Tirar o dinheiro ao longo de (anos)" no dashboard (1–30, default 1). Em cada ano vende 1/(N−j) do que resta; impostos ano a ano (IRS por escalões, PME 50k/ano, 28%). Totais nominais. "Fica na empresa" fica no fim do prazo. Cenários antigos sem o campo → 1.
- `calcIrsMaisValias` substituída por `withdrawPersonal` (antiguidade por tranche mantém-se).
- Fontes locais via @fontsource 5.3.0 (Fraunces, IBM Plex Sans/Mono); Google Fonts removido. Backup de package*.json em `.bak/2026-09-29-fonts/`.
- Anteriores: 28% sempre na linha "tira tudo" (linhas lado a lado, a não escolhida atenuada), dedução específica cat. A (IAS 2026 = 537,13€), textos de microentidade, UI (copy, delegação, gráfico responsivo, favicon, fieldset), strict, sanitizeInputs.

- Levantamento faseado também no assistente (pergunta 5 de 10) e no gráfico (continua até anos+N−1, marca vertical "Levantamento →").
- Gráfico interativo: tooltip (rato/toque) com valor e dinheiro posto por ano, linha-guia, setas/Home/End com foco. Cores via CSS vars (style), sem redesenho ao mudar tema.
- Exportar PDF: botão na toolbar → window.print(); CSS @media print (tema claro forçado, sem inputs/botões), resumo dos dados (#printSummary), pressupostos abertos, título = nome do cenário + data (nome sugerido do ficheiro).
- Levantamento com valor fixo: `levantamentoAnual` (bruto, igual nas 3 opções; 0 = partes iguais) + `anosLevantamento` = máximo de anos (último ano vende o resto; para se esgotar antes). `WithdrawalPlan` em withdrawal.ts; gráfico corta anos vazios (`trimEmptyTail`). Vendas pro-rata entre tranches (não FIFO).
- "Anos até vender" → "Começar a tirar em (ano)" civil (`anoInicio`; `Inputs.anos` continua a ser nº de anos). `BASE_YEAR`/`calendarYear` em format.ts; gráfico e tooltip em anos civis.
- Rentabilidade com 2 casas decimais (sanitize arredonda; step 0.01; fim do ruído 7.000000000000001).
- Assistente com 11 perguntas.
- Gráfico: "Dinheiro posto" → "Capital"; tooltip mostra capital + juros compostos (valor − capital).

Pendentes: FIFO nas vendas pessoais (regra legal), 5 (derrama), 8 (validar cenários — parcialmente via sanitizeInputs na tabela), 16 (commit inicial).
