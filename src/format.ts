const eurFormatter = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export const formatEUR = (value: number): string => eurFormatter.format(value);

const compactEurFormatter = new Intl.NumberFormat('pt-PT', {
  notation: 'compact',
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 1,
});

export const formatCompactEUR = (value: number): string => compactEurFormatter.format(value);

export const formatPct = (value: number, decimals = 1): string => (value * 100).toFixed(decimals).replace('.', ',') + '%';

// O ano 0 da simulação é o ano atual; o ano i corresponde ao ano civil BASE_YEAR + i.
export const BASE_YEAR = new Date().getFullYear();

export const calendarYear = (i: number): number => BASE_YEAR + i;

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
