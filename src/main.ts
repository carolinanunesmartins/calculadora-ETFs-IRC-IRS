import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/500-italic.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles.css';
import { BASE_YEAR, calendarYear, escapeHtml, formatEUR, formatPct } from './format';
import { IRC_REGIMES, MICRO_ENTITY_BALANCE_LIMIT, type RegimeIrc } from './tax/irc';
import { bestRow, computeResults, INPUT_LIMITS, personaRows, sanitizeInputs, type Inputs, type PersonaRow, type RowKey } from './tax/results';
import { drawChart, initChart } from './ui/chart';
import { applyInputs, byId, readInputs, syncCapitalEmpresa } from './ui/dom';
import { loadScenarios, saveScenarios } from './ui/scenarios';
import { createWizard, type WizardAnswers } from './ui/wizard';

// Nome usado no resumo e no nome do ficheiro PDF: o último cenário carregado ou guardado.
let currentScenarioName = '';

function scenarioTitle(): string {
  return byId<HTMLInputElement>('scenarioName').value.trim() || currentScenarioName || 'Simulação';
}

function describeWithdrawal(inp: Inputs): string {
  if (inp.anosLevantamento === 1) return 'De uma vez';
  if (inp.levantamentoAnual > 0) return `${formatEUR(inp.levantamentoAnual)}/ano, no máximo ${inp.anosLevantamento} anos`;
  return `Partes iguais ao longo de ${inp.anosLevantamento} anos`;
}

function renderPrintSummary(inp: Inputs) {
  const r = computeResults(inp);
  const items: [string, string][] = [
    ['Valor a investir', formatEUR(inp.capitalPessoal)],
    ['Reforço anual', formatEUR(inp.aporteAnual)],
    ['Rentabilidade anual', formatPct(inp.retorno, 2)],
    ['Começar a tirar em', `${calendarYear(inp.anos)} (${inp.anos} anos)`],
    ['Levantamento', describeWithdrawal(inp)],
    ['Rendimento bruto anual', formatEUR(inp.rendimentoBase)],
    ['Sede da empresa', IRC_REGIMES[inp.regimeIrc].label],
    ['PME ou small-mid cap', inp.usarReduzida ? 'Sim' : 'Não'],
    ['IRC sobre os ETFs', inp.ircAnual ? 'Todos os anos' : 'Só na venda'],
    ['No fim do prazo', inp.distribui ? 'Tira tudo' : 'Fica na empresa'],
    ['Valor que a empresa investe', formatEUR(r.capitalEmpresa)],
    ['Reforço anual da empresa', formatEUR(r.aporteAnualEmpresa)],
  ];
  byId('printSummary').innerHTML = `
    <h2>${escapeHtml(scenarioTitle())}</h2>
    <div class="date">${new Date().toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    <dl>${items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}

function renderCompareTable(rows: PersonaRow[], distribui: boolean) {
  const bestKey = bestRow(rows).key;
  // A linha da empresa que não corresponde à escolha "No fim do prazo" fica atenuada.
  const mutedKey: RowKey = distribui ? 'empresaMantem' : 'empresaDistribui';
  byId('compareBody').innerHTML = rows
    .map((r) => {
      const isBest = r.key === bestKey;
      return `
      <tr class="${isBest ? 'best' : ''} ${r.key === mutedKey ? 'muted' : ''}">
        <td class="who">
          <span class="persona-tag ${r.cls}">${r.tag}</span>${r.title}
          <span class="persona-desc">${r.desc}${isBest ? '<span class="best-flag">Melhor</span>' : ''}</span>
        </td>
        <td>${formatEUR(r.bruto)}</td>
        <td>${formatEUR(r.ganho)}</td>
        <td class="tax">− ${formatEUR(r.imposto)}</td>
        <td>${r.ganho > 0 ? formatPct(r.imposto / r.ganho) : '—'}</td>
        <td style="font-weight:600">${formatEUR(r.liquido)}</td>
      </tr>`;
    })
    .join('');
}

function renderScenarios() {
  const list = loadScenarios();
  const empty = byId('scenariosEmpty');
  const table = byId('scenariosTable');

  if (list.length === 0) {
    empty.style.display = 'block';
    table.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  table.style.display = 'table';

  byId('scenariosBody').innerHTML = list
    .map((s) => {
      const r = computeResults(sanitizeInputs(s.inputs));
      return `<tr>
        <td class="who">${escapeHtml(s.name)}</td>
        <td>${formatEUR(r.liquidoPessoal)}</td>
        <td>${formatEUR(r.liquidoTransparencia)}</td>
        <td>${formatEUR(r.liquidoEmpresaDistribui)}</td>
        <td>${formatEUR(r.valorAposIrc)}</td>
        <td class="actions">
          <button class="ghost" data-load="${s.id}" type="button" title="Carregar cenário">Carregar</button>
          <button class="ghost" data-remove="${s.id}" type="button" title="Remover cenário">✕</button>
        </td>
      </tr>`;
    })
    .join('');
}

function update() {
  syncCapitalEmpresa();
  const inp = readInputs();
  const r = computeResults(inp);

  byId('antiguidadeInfo').textContent =
    r.desconto > 0
      ? `Com ${inp.anos} anos, ${formatPct(r.desconto)} do ganho do valor inicial fica isento${inp.aporteAnual > 0 ? '; cada reforço conta a antiguidade desde que entra' : ''}.`
      : 'Abaixo de 2 anos não há desconto por antiguidade.';
  byId('antiguidadeTag').textContent = `${BASE_YEAR} → ${calendarYear(inp.anos)} · ${describeWithdrawal(inp).toLowerCase()}`;

  const maxBalanco = Math.max(...r.empresa.path.map((p) => p.value));
  byId('warningBox').innerHTML =
    !inp.ircAnual && maxBalanco > MICRO_ENTITY_BALANCE_LIMIT
      ? `<div class="warning"><b>Nota:</b> a carteira da empresa passa os ${formatEUR(MICRO_ENTITY_BALANCE_LIMIT)} de balanço. Só isto não
        tira o estatuto de microentidade: a empresa teria de ultrapassar também ${formatEUR(900000)} de volume de negócios ou 10 trabalhadores,
        em 2 anos seguidos. Se for o teu caso, muda para "Todos os anos" para ver o impacto.</div>`
      : '';

  const rows = personaRows(r);
  const best = bestRow(rows);
  byId('verdict').innerHTML = `<div class="verdict">
    <div class="label">Melhor opção com o dinheiro no teu bolso</div>
    <div class="big">${best.title} — ${best.desc.charAt(0).toLowerCase() + best.desc.slice(1)}: ${formatEUR(best.liquido)}</div>
  </div>`;
  byId('thesis').innerHTML = `<ul>
    <li>A empresa começa com <b>${formatEUR(r.capitalEmpresa)}</b> em vez de <b>${formatEUR(inp.capitalPessoal)}</b>, porque o dinheiro ainda não pagou IRS para sair dela.</li>
    <li>Se tirares tudo no fim, pagas IRC e depois 28% sobre <b>todo</b> o valor que sai — não só sobre o ganho.</li>
    <li>Se deixares o dinheiro na empresa, ficam lá <b>${formatEUR(r.valorAposIrc)}</b> a render — mas os 28% continuam por pagar no dia em que o tirares.</li>
  </ul>`;

  renderCompareTable(rows, inp.distribui);
  drawChart(r.pathPessoal, r.pathEmpresa, r.pathPessoal.length - 1 > inp.anos ? inp.anos : undefined);
}

function showDashboard() {
  byId('wizard').hidden = true;
  byId('dashboard').hidden = false;
  update();
  renderScenarios();
}

function answersToInputs(a: WizardAnswers): Partial<Inputs> {
  return {
    capitalPessoal: a.capitalPessoal as number,
    aporteAnual: (a.aporteAnual as number | undefined) || 0,
    retorno: Number(((a.retorno as number) / 100).toFixed(4)),
    anos: a.anos as number,
    anosLevantamento: (a.anosLevantamento as number | undefined) || 1,
    levantamentoAnual: (a.levantamentoAnual as number | undefined) || 0,
    rendimentoBase: a.rendimentoBase as number,
    regimeIrc: a.regimeIrc as RegimeIrc,
    usarReduzida: !!a.usarReduzida,
    ircAnual: !!a.ircAnual,
    distribui: !!a.distribui,
  };
}

function inputsToAnswers(inp: Inputs): WizardAnswers {
  return {
    capitalPessoal: inp.capitalPessoal,
    aporteAnual: inp.aporteAnual,
    retorno: Number((inp.retorno * 100).toFixed(2)),
    anos: inp.anos,
    anosLevantamento: inp.anosLevantamento,
    levantamentoAnual: inp.levantamentoAnual || undefined,
    rendimentoBase: inp.rendimentoBase,
    regimeIrc: inp.regimeIrc,
    usarReduzida: inp.usarReduzida,
    ircAnual: inp.ircAnual,
    distribui: inp.distribui,
  };
}

const wizard = createWizard({
  // O assistente não mexe no valor personalizado da empresa; mantém-se o que já estava.
  onComplete: (answers) => {
    currentScenarioName = '';
    applyInputs({ ...readInputs(), ...answersToInputs(answers) });
    showDashboard();
  },
  onLoadScenario: (scenario) => {
    currentScenarioName = scenario.name;
    applyInputs(scenario.inputs);
    showDashboard();
  },
});

byId('saveScenarioBtn').addEventListener('click', () => {
  const nameField = byId<HTMLInputElement>('scenarioName');
  const list = loadScenarios();
  const name = nameField.value.trim() || `Cenário ${list.length + 1}`;
  list.push({ id: Date.now(), name, inputs: readInputs() });
  currentScenarioName = name;
  saveScenarios(list);
  nameField.value = '';
  renderScenarios();
});

byId('scenariosBody').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-load], [data-remove]');
  if (!btn) return;
  if (btn.dataset.load) {
    const scenario = loadScenarios().find((s) => String(s.id) === btn.dataset.load);
    if (scenario) {
      currentScenarioName = scenario.name;
      applyInputs(scenario.inputs);
      update();
    }
  } else {
    saveScenarios(loadScenarios().filter((s) => String(s.id) !== btn.dataset.remove));
    renderScenarios();
  }
});

byId('exportPdfBtn').addEventListener('click', () => window.print());

// O título da página é o nome sugerido para o PDF; os pressupostos abrem para saírem impressos.
let printState: { title: string; assumptionsOpen: boolean } | null = null;
window.addEventListener('beforeprint', () => {
  const assumptions = document.querySelector<HTMLDetailsElement>('details.assumptions')!;
  printState = { title: document.title, assumptionsOpen: assumptions.open };
  renderPrintSummary(readInputs());
  assumptions.open = true;
  document.title = `${scenarioTitle()} — ETFs IRS vs IRC — ${new Date().toISOString().slice(0, 10)}`;
});
window.addEventListener('afterprint', () => {
  if (!printState) return;
  document.title = printState.title;
  document.querySelector<HTMLDetailsElement>('details.assumptions')!.open = printState.assumptionsOpen;
  printState = null;
});

byId('restartWizardBtn').addEventListener('click', () => {
  const answers = inputsToAnswers(readInputs());
  byId('dashboard').hidden = true;
  byId('wizard').hidden = false;
  wizard.start(answers);
});

document
  .querySelectorAll('#dashboard input[type="number"], #dashboard input[type="checkbox"]')
  .forEach((el) => el.addEventListener('input', update));
document
  .querySelectorAll('#dashboard input[type="radio"], #dashboard select')
  .forEach((el) => el.addEventListener('change', update));

byId<HTMLInputElement>('anoInicio').min = String(BASE_YEAR + 1);
byId<HTMLInputElement>('anoInicio').max = String(BASE_YEAR + INPUT_LIMITS.anosMax);

initChart();
wizard.start();
