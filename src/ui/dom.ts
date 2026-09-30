import { BASE_YEAR } from '../format';
import type { RegimeIrc } from '../tax/irc';
import { grossUpForDividends, sanitizeInputs, type Inputs } from '../tax/results';

export const byId = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

const inputEl = (id: string) => byId<HTMLInputElement>(id);
const numberValue = (id: string) => parseFloat(inputEl(id).value) || 0;
const checkedRadio = (name: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
const checkRadio = (name: string, value: string) => {
  document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`)!.checked = true;
};

export function readInputs(): Inputs {
  return sanitizeInputs({
    capitalPessoal: numberValue('capitalPessoal'),
    aporteAnual: numberValue('aporteAnual'),
    retorno: numberValue('retorno') / 100,
    anos: (parseInt(inputEl('anoInicio').value, 10) || BASE_YEAR + 1) - BASE_YEAR,
    rendimentoBase: numberValue('rendimentoBase'),
    regimeIrc: byId<HTMLSelectElement>('regimeIrc').value as RegimeIrc,
    usarReduzida: inputEl('reduzidaPME').checked,
    ircAnual: checkedRadio('ircTiming') === 'anual',
    distribui: checkedRadio('distribuicao') === 'distribui',
    customCapitalEmpresa: inputEl('customCapitalEmpresa').checked,
    capitalEmpresaCustom: numberValue('capitalEmpresa'),
    aporteAnualEmpresaCustom: numberValue('aporteAnualEmpresa'),
    anosLevantamento: parseInt(inputEl('anosLevantamento').value, 10) || 1,
    levantamentoAnual: numberValue('levantamentoAnual'),
  });
}

export function applyInputs(inp: Partial<Inputs>): void {
  inputEl('capitalPessoal').value = String(inp.capitalPessoal ?? '');
  inputEl('aporteAnual').value = String(inp.aporteAnual ?? 0);
  inputEl('retorno').value = String(Number(((inp.retorno ?? 0) * 100).toFixed(2)));
  inputEl('anoInicio').value = inp.anos === undefined ? '' : String(BASE_YEAR + inp.anos);
  inputEl('anosLevantamento').value = String(inp.anosLevantamento ?? 1);
  inputEl('levantamentoAnual').value = inp.levantamentoAnual ? String(inp.levantamentoAnual) : '';
  inputEl('rendimentoBase').value = String(inp.rendimentoBase ?? '');
  byId<HTMLSelectElement>('regimeIrc').value = inp.regimeIrc || 'continente';
  inputEl('reduzidaPME').checked = !!inp.usarReduzida;
  checkRadio('ircTiming', inp.ircAnual ? 'anual' : 'venda');
  checkRadio('distribuicao', inp.distribui ? 'distribui' : 'mantem');
  inputEl('customCapitalEmpresa').checked = !!inp.customCapitalEmpresa;
  if (inp.customCapitalEmpresa) {
    inputEl('capitalEmpresa').value = String(inp.capitalEmpresaCustom ?? 0);
    inputEl('aporteAnualEmpresa').value = String(inp.aporteAnualEmpresaCustom ?? 0);
  }
}

export function syncCapitalEmpresa(): void {
  const custom = inputEl('customCapitalEmpresa').checked;
  const capitalField = inputEl('capitalEmpresa');
  const aporteField = inputEl('aporteAnualEmpresa');
  capitalField.disabled = !custom;
  aporteField.disabled = !custom;

  if (!custom) {
    capitalField.value = String(grossUpForDividends(numberValue('capitalPessoal')));
    aporteField.value = String(grossUpForDividends(numberValue('aporteAnual')));
  }
}
