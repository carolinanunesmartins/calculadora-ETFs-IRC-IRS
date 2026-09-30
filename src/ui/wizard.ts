import { BASE_YEAR, escapeHtml } from '../format';
import type { Inputs } from '../tax/results';
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
// `optional`: pode ficar em branco.
type NumberStep = { id: WizardKey; question: string; helper: string; type: 'number'; suffix: string; min: number; max?: number; step: number; placeholder: string; optional?: boolean };
type ChoiceStep = { id: WizardKey; question: string; helper: string; type: 'choice'; options: { label: string; sub?: string; value: ChoiceValue }[] };
type WizardStep = NumberStep | ChoiceStep;

// Valores do assistente: `retorno` em %, não em fração; `anos` como ano civil de início do levantamento.
export type WizardAnswers = Partial<Record<WizardKey, number | ChoiceValue>>;

export const WIZARD_STEPS: WizardStep[] = [
  { id: 'capitalPessoal', question: 'Quanto tens disponível para investir a título pessoal?', helper: 'Dinheiro teu, já depois de impostos.', type: 'number', suffix: '€', min: 0, step: 5000, placeholder: 'Ex.: 100000' },
  { id: 'aporteAnual', question: 'Vais reforçar o investimento todos os anos?', helper: 'Deixa em branco se não fores reforçar.', type: 'number', suffix: '€/ano', min: 0, step: 1000, placeholder: 'Ex.: 0', optional: true },
  { id: 'retorno', question: 'Que retorno anual esperas do investimento?', helper: 'Para ETFs globais a longo prazo, 7% é uma estimativa comum.', type: 'number', suffix: '%', min: 0, max: 30, step: 0.01, placeholder: 'Ex.: 7' },
  { id: 'anos', question: 'Em que ano queres começar a tirar o dinheiro?', helper: `Os reforços param nesse ano. Com 2, 5 e 8 anos investido, pagas menos imposto sobre o ganho pessoal.`, type: 'number', suffix: '', min: BASE_YEAR + 1, max: BASE_YEAR + 40, step: 1, placeholder: `Ex.: ${BASE_YEAR + 10}` },
  { id: 'levantamentoAnual', question: 'Quanto queres tirar por ano?', helper: 'Valor bruto vendido por ano, antes de impostos. Deixa em branco para dividir em partes iguais pelos anos da pergunta seguinte.', type: 'number', suffix: '€/ano', min: 0, step: 1000, placeholder: 'Ex.: 20000', optional: true },
  { id: 'anosLevantamento', question: 'Durante quantos anos, no máximo?', helper: '1 = tudo de uma vez. No último ano vende-se o que sobrar; se o dinheiro acabar antes, o levantamento termina aí. O que fica continua a render e os impostos são pagos ano a ano.', type: 'number', suffix: 'anos', min: 1, max: 30, step: 1, placeholder: 'Ex.: 20' },
  { id: 'rendimentoBase', question: 'Qual é o teu rendimento bruto anual total?', helper: 'Salário bruto mais extras (rendas, recibos verdes…). Na transparência fiscal o ganho junta-se a este valor.', type: 'number', suffix: '€', min: 0, step: 1000, placeholder: 'Ex.: 20000' },
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
      </div>`;
      const input = byId<HTMLInputElement>('wizardInput');
      input.addEventListener('input', () => {
        answers[step.id] = input.value === '' ? undefined : parseFloat(input.value);
        updateNavState();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !nextBtn.disabled) goNext();
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
      renderStep();
      renderChips();
    },
  };
}
