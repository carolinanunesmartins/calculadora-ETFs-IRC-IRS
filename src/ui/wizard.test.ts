import { describe, expect, it } from 'vitest';
import { BASE_YEAR } from '../format';
import { isStepAnswerValid, WIZARD_STEPS } from './wizard';

const step = (id: string) => WIZARD_STEPS.find((s) => s.id === id)!;

describe('isStepAnswerValid', () => {
  it('rejeita valores acima do máximo', () => {
    expect(isStepAnswerValid(step('retorno'), 500)).toBe(false);
    expect(isStepAnswerValid(step('anos'), BASE_YEAR + 41)).toBe(false);
    expect(isStepAnswerValid(step('anos'), BASE_YEAR + 40)).toBe(true);
  });

  it('rejeita valores abaixo do mínimo', () => {
    expect(isStepAnswerValid(step('capitalPessoal'), -1)).toBe(false);
    expect(isStepAnswerValid(step('anos'), BASE_YEAR)).toBe(false);
  });

  it('reforço anual pode ficar em branco, mas não negativo', () => {
    expect(isStepAnswerValid(step('aporteAnual'), undefined)).toBe(true);
    expect(isStepAnswerValid(step('aporteAnual'), -100)).toBe(false);
  });

  it('levantamento faseado aceita de 1 a 30 anos', () => {
    expect(isStepAnswerValid(step('anosLevantamento'), 1)).toBe(true);
    expect(isStepAnswerValid(step('anosLevantamento'), 30)).toBe(true);
    expect(isStepAnswerValid(step('anosLevantamento'), 0)).toBe(false);
    expect(isStepAnswerValid(step('anosLevantamento'), 31)).toBe(false);
  });

  it('valor por ano pode ficar em branco (partes iguais), mas não negativo', () => {
    expect(isStepAnswerValid(step('levantamentoAnual'), undefined)).toBe(true);
    expect(isStepAnswerValid(step('levantamentoAnual'), 20000)).toBe(true);
    expect(isStepAnswerValid(step('levantamentoAnual'), -1)).toBe(false);
  });

  it('escolhas só precisam de uma resposta', () => {
    expect(isStepAnswerValid(step('distribui'), false)).toBe(true);
    expect(isStepAnswerValid(step('distribui'), undefined)).toBe(false);
  });
});
