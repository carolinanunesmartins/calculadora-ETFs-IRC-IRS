import { calendarYear, escapeHtml, formatEUR, formatPct } from '../format';
import { INPUT_LIMITS, type Inputs } from '../tax/results';
import { byId } from './dom';
import { loadScenarios, type Scenario } from './scenarios';

type WizardKey = keyof Pick<
  Inputs,
  | 'capitalPessoal'
  | 'aporteAnual'
  | 'retorno'
  | 'anos'
  | 'levantamentoAnual'
  | 'anosLevantamento'
  | 'rendimentoBase'
  | 'regimeIrc'
  | 'usarReduzida'
  | 'ircAnual'
  | 'distribui'
>;
type ChoiceValue = string | boolean;
// `optional`: pode ficar em branco. `presets`: respostas rápidas (um clique responde e avança).
type NumberStep = {
  id: WizardKey;
  question: string;
  helper: string;
  type: 'number';
  suffix: string;
  min: number;
  max?: number;
  step: number;
  placeholder: string;
  optional?: boolean;
  presets: { label: string; value: number | undefined }[];
};
type ChoiceStep = { id: WizardKey; question: string; helper: string; type: 'choice'; options: { label: string; sub?: string; value: ChoiceValue }[] };
type WizardStep = NumberStep | ChoiceStep;

// Valores do assistente: `retorno` em %, não em fração.
export type WizardAnswers = Partial<Record<WizardKey, number | ChoiceValue>>;

export const WIZARD_STEPS: WizardStep[] = [
  { id: 'capitalPessoal', question: 'Quanto tens disponível para investir a título pessoal?', helper: 'Dinheiro teu, já depois de impostos.', type: 'number', suffix: '€', min: 0, step: 5000, placeholder: 'Ex.: 100000',
    presets: [{ label: '25 mil €', value: 25000 }, { label: '50 mil €', value: 50000 }, { label: '100 mil €', value: 100000 }, { label: '250 mil €', value: 250000 }] },
  { id: 'aporteAnual', question: 'Vais reforçar o investimento todos os anos?', helper: 'Quanto juntas por ano, se fores reforçar.', type: 'number', suffix: '€/ano', min: 0, step: 1000, placeholder: 'Ex.: 6000', optional: true,
    presets: [{ label: 'Não vou reforçar', value: undefined }, { label: '2 400 €/ano', value: 2400 }, { label: '6 000 €/ano', value: 6000 }, { label: '12 000 €/ano', value: 12000 }] },
  { id: 'retorno', question: 'Que retorno anual esperas do investimento?', helper: 'Para ETFs globais a longo prazo, 7% é uma estimativa comum.', type: 'number', suffix: '%', min: 0, max: 30, step: 0.01, placeholder: 'Ex.: 7',
    presets: [{ label: '4%', value: 4 }, { label: '5%', value: 5 }, { label: '7%', value: 7 }, { label: '10%', value: 10 }] },
  { id: 'anos', question: 'Queres começar a tirar o dinheiro daqui a quantos anos?', helper: 'Os reforços param nessa altura. Com 2, 5 e 8 anos investido, pagas menos imposto sobre o ganho pessoal.', type: 'number', suffix: 'anos', min: 1, max: INPUT_LIMITS.anosMax, step: 1, placeholder: 'Ex.: 10',
    presets: [{ label: '5 anos', value: 5 }, { label: '10 anos', value: 10 }, { label: '15 anos', value: 15 }, { label: '20 anos', value: 20 }, { label: '30 anos', value: 30 }] },
  { id: 'levantamentoAnual', question: 'Quanto queres tirar por ano?', helper: 'Valor bruto, antes de impostos. Em partes iguais, divide-se pelos anos da pergunta seguinte.', type: 'number', suffix: '€/ano', min: 0, step: 1000, placeholder: 'Ex.: 20000', optional: true,
    presets: [{ label: 'Partes iguais', value: undefined }, { label: '12 mil €/ano', value: 12000 }, { label: '24 mil €/ano', value: 24000 }, { label: '36 mil €/ano', value: 36000 }] },
  { id: 'anosLevantamento', question: 'Durante quantos anos, no máximo?', helper: 'No último ano vende-se o que sobrar; se o dinheiro acabar antes, termina aí. O que fica continua a render.', type: 'number', suffix: 'anos', min: 1, max: INPUT_LIMITS.levantamentoMax, step: 1, placeholder: 'Ex.: 20',
    presets: [{ label: 'Tudo de uma vez', value: 1 }, { label: '10 anos', value: 10 }, { label: '20 anos', value: 20 }, { label: '30 anos', value: 30 }] },
  { id: 'rendimentoBase', question: 'Qual é o teu rendimento bruto anual total?', helper: 'Salário bruto mais extras (rendas, recibos verdes…). Na transparência fiscal o ganho junta-se a este valor.', type: 'number', suffix: '€', min: 0, step: 1000, placeholder: 'Ex.: 20000',
    presets: [{ label: '15 mil €', value: 15000 }, { label: '25 mil €', value: 25000 }, { label: '40 mil €', value: 40000 }, { label: '80 mil €', value: 80000 }] },
  { id: 'regimeIrc', question: 'Onde está sediada a empresa?', helper: '', type: 'choice', options: [
    { label: 'Continente', sub: 'Geral: 19%<br>PME: 15% até 50.000€', value: 'continente' },
    { label: 'Continente — Interior', sub: 'Geral: 19%<br>PME: 12,5% até 50.000€', value: 'interior' },
    { label: 'Açores', sub: 'Geral: 14%<br>PME: 8,75% até 50.000€', value: 'acores' },
    { label: 'Madeira', sub: 'Geral: 13,3%<br>PME: 10,5% até 50.000€', value: 'madeira' },
  ] },
  { id: 'usarReduzida', question: 'A empresa classifica-se como PME ou small-mid cap?', helper: 'Se sim, os primeiros 50.000€ de lucro de cada ano pagam a taxa PME; o resto paga a taxa geral.', type: 'choice', options: [{ label: 'Sim', value: true }, { label: 'Não', value: false }] },
  { id: 'ircAnual', question: 'Quando é que a empresa paga IRC sobre a carteira de ETFs?', helper: 'Só dá para pagar apenas na venda enquanto a empresa for microentidade. Deixa de o ser se ultrapassar 2 de 3 limites (450.000€ de balanço, 900.000€ de volume de negócios, 10 trabalhadores) em 2 anos seguidos.', type: 'choice', options: [{ label: 'Só na venda', value: false }, { label: 'Todos os anos', value: true }] },
  { id: 'distribui', question: 'No fim do prazo, o que é feito ao valor da carteira?', helper: 'Tirar o dinheiro paga mais 28% de IRS; deixá-lo na empresa adia esse imposto.', type: 'choice', options: [{ label: 'Tiro tudo para mim', value: true }, { label: 'Fica na empresa', value: false }] },
];

// Confirmação legível do valor escrito, por baixo do campo.
export function stepHint(step: WizardStep, value: number, answers: WizardAnswers): string {
  switch (step.id) {
    case 'retorno':
      return `${formatPct(value / 100, 2)} ao ano`;
    case 'anos':
      return `Começas a tirar em ${calendarYear(value)}`;
    case 'anosLevantamento': {
      if (value === 1) return 'Tudo de uma vez';
      const inicio = typeof answers.anos === 'number' ? answers.anos : 0;
      return `De ${calendarYear(inicio)} a ${calendarYear(inicio + value - 1)}`;
    }
    case 'aporteAnual':
    case 'levantamentoAnual':
      return `${formatEUR(value)} por ano`;
    default:
      return formatEUR(value);
  }
}

export function isStepAnswerValid(step: WizardStep, val: number | ChoiceValue | undefined): boolean {
  if (step.type === 'choice') return val !== undefined;
  if (step.optional && val === undefined) return true;
  return (
    typeof val === 'number' && !Number.isNaN(val) && val >= step.min && (step.max === undefined || val <= step.max)
  );
}

type WizardCallbacks = {
  onComplete: (answers: WizardAnswers) => void;
  onLoadScenario: (scenario: Scenario) => void;
};

export function createWizard({ onComplete, onLoadScenario }: WizardCallbacks) {
  let stepIndex = 0;
  // Passos já vistos: "Não vou reforçar"/"Partes iguais" (valor em branco) só aparecem marcados ao voltar atrás.
  let maxVisited = 0;
  let answers: WizardAnswers = {};
  const nextBtn = byId<HTMLButtonElement>('wizardNext');

  function currentStepValid(): boolean {
    const step = WIZARD_STEPS[stepIndex];
    return isStepAnswerValid(step, answers[step.id]);
  }

  function updateNavState() {
    nextBtn.disabled = !currentStepValid();
  }

  function renderStep() {
    const step = WIZARD_STEPS[stepIndex];
    byId('wizardMeta').textContent = `Pergunta ${stepIndex + 1} de ${WIZARD_STEPS.length}`;
    byId('wizardProgressBar').style.width = `${(stepIndex / WIZARD_STEPS.length) * 100}%`;
    byId('wizardQuestion').textContent = step.question;
    const helperEl = byId('wizardHelper');
    helperEl.textContent = step.helper;
    helperEl.hidden = !step.helper;

    const area = byId('wizardInputArea');
    if (step.type === 'number') {
      const existing = answers[step.id];
      area.innerHTML = `<div class="wizard-input-row">
        <input type="number" id="wizardInput" min="${step.min}" ${step.max !== undefined ? `max="${step.max}"` : ''} step="${step.step}" placeholder="${step.placeholder}" value="${existing ?? ''}">
        <span class="suffix">${step.suffix}</span>
      </div>
      <div class="wizard-hint" id="wizardHint"></div>
      <div class="preset-row">${step.presets
        .map((p, i) => `<button type="button" class="chip preset ${existing === p.value && (existing !== undefined || stepIndex < maxVisited) ? 'selected' : ''}" data-preset="${i}">${p.label}</button>`)
        .join('')}</div>`;
      const input = byId<HTMLInputElement>('wizardInput');
      const hint = byId('wizardHint');
      const refreshHint = () => {
        const v = answers[step.id];
        hint.textContent = typeof v === 'number' && isStepAnswerValid(step, v) ? stepHint(step, v, answers) : '';
      };
      refreshHint();
      input.addEventListener('input', () => {
        answers[step.id] = input.value === '' ? undefined : parseFloat(input.value);
        refreshHint();
        updateNavState();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !nextBtn.disabled) goNext();
      });
      area.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((btn) => {
        btn.addEventListener('click', () => {
          answers[step.id] = step.presets[parseInt(btn.dataset.preset!, 10)].value;
          goNext();
        });
      });
      setTimeout(() => input.focus(), 0);
    } else {
      area.innerHTML = `<div class="choice-grid">${step.options
        .map(
          (opt, i) => `
        <button type="button" class="choice-btn ${answers[step.id] === opt.value ? 'selected' : ''}" data-idx="${i}">${opt.label}${opt.sub ? `<span class="choice-sub">${opt.sub}</span>` : ''}</button>`,
        )
        .join('')}</div>`;
      area.querySelectorAll<HTMLButtonElement>('.choice-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          answers[step.id] = step.options[parseInt(btn.dataset.idx!, 10)].value;
          renderStep();
          // Mostra a escolha marcada por um instante antes de avançar.
          const current = stepIndex;
          setTimeout(() => stepIndex === current && goNext(), 180);
        });
      });
    }

    byId('wizardBack').style.visibility = stepIndex === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = stepIndex === WIZARD_STEPS.length - 1 ? 'Ver resultados →' : 'Seguinte →';
    updateNavState();
  }

  function goNext() {
    if (!currentStepValid()) return;
    if (stepIndex === WIZARD_STEPS.length - 1) {
      onComplete(answers);
    } else {
      stepIndex++;
      maxVisited = Math.max(maxVisited, stepIndex);
      renderStep();
    }
  }

  function goBack() {
    if (stepIndex === 0) return;
    stepIndex--;
    renderStep();
  }

  byId('wizardChipRow').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-scenario]');
    const scenario = btn && loadScenarios().find((s) => String(s.id) === btn.dataset.scenario);
    if (scenario) onLoadScenario(scenario);
  });

  function renderChips() {
    const list = loadScenarios();
    const wrap = byId('wizardScenarios');
    if (list.length === 0) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    byId('wizardChipRow').innerHTML = list
      .map((s) => `<button type="button" class="chip" data-scenario="${s.id}">${escapeHtml(s.name)}</button>`)
      .join('');
  }

  nextBtn.addEventListener('click', goNext);
  byId('wizardBack').addEventListener('click', goBack);

  return {
    start(initial: WizardAnswers = {}) {
      answers = initial;
      stepIndex = 0;
      maxVisited = Object.keys(initial).length > 0 ? WIZARD_STEPS.length : 0;
      renderStep();
      renderChips();
    },
  };
}
