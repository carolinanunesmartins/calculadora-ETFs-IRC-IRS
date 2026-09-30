import { describe, expect, it } from 'vitest';
import { BASE_YEAR, calendarYear, escapeHtml, formatCompactEUR, formatPct } from './format';

describe('formatPct', () => {
  it('usa vírgula decimal', () => {
    expect(formatPct(0.285)).toBe('28,5%');
  });

  it('aceita o número de casas decimais', () => {
    expect(formatPct(0.0725, 2)).toBe('7,25%');
  });
});

describe('escapeHtml', () => {
  it('neutraliza HTML em nomes de cenários', () => {
    expect(escapeHtml('<img src=x onerror="a">')).toBe('&lt;img src=x onerror=&quot;a&quot;&gt;');
  });
});

describe('calendarYear', () => {
  it('o ano 0 é o ano atual', () => {
    expect(BASE_YEAR).toBe(new Date().getFullYear());
    expect(calendarYear(0)).toBe(BASE_YEAR);
    expect(calendarYear(10)).toBe(BASE_YEAR + 10);
  });
});

describe('formatCompactEUR', () => {
  it('abrevia milhares e milhões', () => {
    expect(formatCompactEUR(250000)).toMatch(/^250\smil\s€$/);
    expect(formatCompactEUR(1500000)).toMatch(/^1,5\sM\s€$/);
    expect(formatCompactEUR(0)).toMatch(/^0\s€$/);
  });
});
