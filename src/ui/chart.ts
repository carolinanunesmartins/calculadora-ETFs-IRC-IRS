import { calendarYear, formatCompactEUR, formatEUR } from '../format';
import type { PathPoint } from '../tax/projection';
import { byId } from './dom';

const H = 260;
const PAD = { l: 66, r: 10, t: 14, b: 24 };

type ChartState = {
  pathPessoal: PathPoint[];
  pathEmpresa: PathPoint[];
  inicioLevantamento?: number;
  W: number;
  years: number;
  x: (i: number) => number;
  y: (v: number) => number;
};

let state: ChartState | null = null;
let activeYear: number | null = null;

// Marcas do eixo Y em valores redondos (1, 2, 2,5 ou 5 × 10ⁿ), com cerca de 4 intervalos.
export function niceTicks(maxValue: number): number[] {
  if (maxValue <= 0) return [0, 1];
  const rough = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= rough)! * magnitude;
  const count = Math.ceil(maxValue / step);
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

export function nearestYear(px: number, width: number, years: number): number {
  const plotW = width - PAD.l - PAD.r;
  return Math.min(years, Math.max(0, Math.round(((px - PAD.l) / plotW) * years)));
}

// Cores via variáveis CSS (style, não atributos) para seguirem o tema e a impressão sem redesenhar.
export function initChart(): void {
  const svg = byId('chart');
  new ResizeObserver(() => state && drawChart(state.pathPessoal, state.pathEmpresa, state.inicioLevantamento)).observe(svg);

  const fromPointer = (e: PointerEvent) => {
    if (!state) return;
    const rect = svg.getBoundingClientRect();
    showYear(nearestYear(((e.clientX - rect.left) / rect.width) * state.W, state.W, state.years));
  };
  svg.addEventListener('pointermove', fromPointer);
  svg.addEventListener('pointerdown', fromPointer);
  svg.addEventListener('pointerleave', hideHover);
  svg.addEventListener('blur', hideHover);
  svg.addEventListener('focus', () => state && showYear(activeYear ?? state.years));
  svg.addEventListener('keydown', (e) => {
    if (!state) return;
    const current = activeYear ?? state.years;
    const moves: Record<string, number> = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: state.years };
    if (!(e.key in moves)) return;
    e.preventDefault();
    showYear(Math.min(state.years, Math.max(0, moves[e.key])));
  });
}

// `inicioLevantamento`: ano em que começa o levantamento faseado (marcado com uma linha vertical).
export function drawChart(pathPessoal: PathPoint[], pathEmpresa: PathPoint[], inicioLevantamento?: number): void {
  const svg = byId('chart');
  const W = svg.clientWidth || 900;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const allValues = pathPessoal.map((p) => p.value).concat(pathEmpresa.map((p) => p.value));
  const ticks = niceTicks(Math.max(...allValues));
  const maxV = ticks[ticks.length - 1];
  const years = pathPessoal.length - 1;

  const x = (i: number) => PAD.l + (i / years) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - (v / maxV) * (H - PAD.t - PAD.b);
  state = { pathPessoal, pathEmpresa, inicioLevantamento, W, years, x, y };

  const toPath = (points: PathPoint[], field: 'invested' | 'value') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.year).toFixed(1)} ${y(p[field]).toFixed(1)}`).join(' ');

  let gridLines = '';
  for (const v of ticks) {
    const yy = y(v).toFixed(1);
    gridLines += `<line x1="${PAD.l}" y1="${yy}" x2="${W - PAD.r}" y2="${yy}" style="stroke:var(--border)" stroke-width="1"/>`;
    gridLines += `<text x="${PAD.l - 8}" y="${(y(v) + 4).toFixed(1)}" font-size="11" text-anchor="end" style="fill:var(--text-2);font-family:var(--font-mono)">${formatCompactEUR(v)}</text>`;
  }

  let xLabels = '';
  const step = Math.max(1, Math.round(years / Math.max(2, Math.floor(W / 80))));
  for (let i = 0; i <= years; i += step) {
    const anchor = i === 0 ? 'start' : i === years ? 'end' : 'middle';
    xLabels += `<text x="${x(i).toFixed(1)}" y="${H - 6}" font-size="10" text-anchor="${anchor}" style="fill:var(--text-2)">${calendarYear(i)}</text>`;
  }

  let marker = '';
  if (inicioLevantamento !== undefined) {
    const mx = x(inicioLevantamento).toFixed(1);
    marker = `<line x1="${mx}" y1="${PAD.t}" x2="${mx}" y2="${H - PAD.b}" style="stroke:var(--text-2)" stroke-width="1" stroke-dasharray="3 3"/>
      <text x="${(x(inicioLevantamento) + 5).toFixed(1)}" y="${PAD.t + 10}" font-size="10" style="fill:var(--text-2)">Levantamento →</text>`;
  }

  svg.innerHTML = `
    ${gridLines}
    ${xLabels}
    ${marker}
    <path d="${toPath(pathPessoal, 'invested')}" fill="none" style="stroke:var(--accent-personal)" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.7"/>
    <path d="${toPath(pathEmpresa, 'invested')}" fill="none" style="stroke:var(--accent-company)" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.7"/>
    <path d="${toPath(pathPessoal, 'value')}" fill="none" style="stroke:var(--accent-personal)" stroke-width="2.5"/>
    <path d="${toPath(pathEmpresa, 'value')}" fill="none" style="stroke:var(--accent-company)" stroke-width="2.5"/>
    <g id="chartHover"></g>
  `;

  if (activeYear !== null && activeYear <= years) showYear(activeYear);
  else hideHover();
}

function showYear(i: number): void {
  if (!state) return;
  activeYear = i;
  const { pathPessoal, pathEmpresa, inicioLevantamento, W, x, y } = state;
  const pessoal = pathPessoal[i];
  const empresa = pathEmpresa[i];
  const cx = x(i).toFixed(1);

  byId('chartHover').innerHTML = `
    <line x1="${cx}" y1="${PAD.t}" x2="${cx}" y2="${H - PAD.b}" style="stroke:var(--text-2)" stroke-width="1" opacity="0.5"/>
    <circle cx="${cx}" cy="${y(pessoal.value).toFixed(1)}" r="4" style="fill:var(--accent-personal);stroke:var(--surface)" stroke-width="2"/>
    <circle cx="${cx}" cy="${y(empresa.value).toFixed(1)}" r="4" style="fill:var(--accent-company);stroke:var(--surface)" stroke-width="2"/>`;

  const fase =
    inicioLevantamento !== undefined && i > inicioLevantamento ? ` · ${i - inicioLevantamento + 1}.º ano a tirar` : '';
  const tooltip = byId('chartTooltip');
  tooltip.innerHTML = `
    <div class="t-year">${calendarYear(i)}${fase}</div>
    <div class="t-row"><span><i style="background:var(--accent-personal)"></i>Pessoal</span><b>${formatEUR(pessoal.value)}</b></div>
    <div class="t-sub">capital: ${formatEUR(pessoal.invested)}</div>
    <div class="t-sub">juros compostos: ${formatEUR(pessoal.value - pessoal.invested)}</div>
    ${pessoal.withdrawn ? `<div class="t-sub t-out">levantado: ${formatEUR(pessoal.withdrawn)}</div>` : ''}
    <div class="t-row"><span><i style="background:var(--accent-company)"></i>Empresa</span><b>${formatEUR(empresa.value)}</b></div>
    <div class="t-sub">capital: ${formatEUR(empresa.invested)}</div>
    <div class="t-sub">juros compostos: ${formatEUR(empresa.value - empresa.invested)}</div>
    ${empresa.withdrawn ? `<div class="t-sub t-out">levantado: ${formatEUR(empresa.withdrawn)}</div>` : ''}`;
  tooltip.style.left = `${(x(i) / W) * 100}%`;
  tooltip.classList.toggle('flip', x(i) > W * 0.6);
  tooltip.hidden = false;
}

function hideHover(): void {
  activeYear = null;
  const hover = document.getElementById('chartHover');
  if (hover) hover.innerHTML = '';
  byId('chartTooltip').hidden = true;
}
