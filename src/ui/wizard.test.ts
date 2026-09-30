import { describe, expect, it } from 'vitest';
import { BASE_YEAR } from '../format';
import { isStepAnswerValid, stepHint, WIZARD_STEPS } from './wizard';

const step = (id: string) => WIZARD_STEPS.find((s) => s.id === id)!;

describe('isStepAnswerValid', () => {
  it('rejeita valores acima do máximo', () => {
    expect(isStepAnswerValid(step('retorno'), 500)).toBe(false);
    expect(isStepAnswerValid(step('anos'), 101)).toBe(false);
    expect(isStepAnswerValid(step('anos'), 60)).toBe(true);
  });

  it('rejeita valores abaixo do mínimo', () => {
    expect(isStepAnswerValid(step('capitalPessoal'), -1)).toBe(false);
    expect(isStepAnswerValid(step('anos'), 0)).toBe(false);
  });

  it('reforço anual pode ficar em branco, mas não negativo', () => {
    expect(isStepAnswerValid(step('aporteAnual'), undefined)).toBe(true);
    expect(isStepAnswerValid(step('aporteAnual'), -100)).toBe(false);
  });

  it('levantamento aceita de 1 a 100 anos', () => {
    expect(isStepAnswerValid(step('anosLevantamento'), 1)).toBe(true);
    expect(isStepAnswerValid(step('anosLevantamento'), 45)).toBe(true);
    expect(isStepAnswerValid(step('anosLevantamento'), 100)).toBe(true);
    expect(isStepAnswerValid(step('anosLevantamento'), 0)).toBe(false);
    expect(isStepAnswerValid(step('anosLevantamento'), 101)).toBe(false);
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

describe('respostas rápidas', () => {
  it('a pergunta 4 pede quantos anos faltam para começar a tirar', () => {
    expect(WIZARD_STEPS[3].id).toBe('anos');
    expect(WIZARD_STEPS[3].question).toBe('Queres começar a tirar o dinheiro daqui a quantos anos?');
  });

  it('todas as perguntas numéricas têm respostas rápidas válidas', () => {
    for (const s of WIZARD_STEPS) {
      if (s.type !== 'number') continue;
      expect(s.presets.length).toBeGreaterThan(0);
      for (const p of s.presets) expect(isStepAnswerValid(s, p.value)).toBe(true);
    }
  });

  it('mostra o valor escrito de forma legível', () => {
    expect(stepHint(step('anos'), 10, {})).toBe(`Começas a tirar em ${BASE_YEAR + 10}`);
    expect(stepHint(step('capitalPessoal'), 100000, {})).toMatch(/^100\s000\s€$/);
    expect(stepHint(step('retorno'), 7.25, {})).toBe('7,25% ao ano');
    expect(stepHint(step('anosLevantamento'), 1, {})).toBe('Tudo de uma vez');
    expect(stepHint(step('anosLevantamento'), 20, { anos: 10 })).toBe(`De ${BASE_YEAR + 10} a ${BASE_YEAR + 29}`);
  });
});
