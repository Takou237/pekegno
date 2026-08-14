export function formatNumber(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 2,
  }).format(n);
  return formatted.replace(/[\u202f\u00a0]/g, ' ');
}

export function formatCurrency(value: number | string | null | undefined): string {
  return `${formatNumber(value)} FCFA`;
}

const UNITS = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

function under100(n: number): string {
  if (n < 20) return UNITS[n];
  if (n === 70) return 'soixante-dix';
  if (n === 80) return 'quatre-vingts';
  if (n === 90) return 'quatre-vingt-dix';
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  if (unit === 0) return TENS[ten];
  if (ten === 7) return unit === 1 ? 'soixante-et-onze' : `soixante-${UNITS[unit + 10]}`;
  if (ten === 9) return `quatre-vingt-${UNITS[unit + 10]}`;
  if (unit === 1) return ten === 8 ? 'quatre-vingt-un' : `${TENS[ten]}-et-un`;
  return `${TENS[ten]}-${UNITS[unit]}`;
}

function under1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let out = '';
  if (hundreds > 0) out = hundreds === 1 ? 'cent' : `${UNITS[hundreds]}-cent`;
  if (rest > 0) out = out ? `${out}-${under100(rest)}` : under100(rest);
  return out;
}

export function numberToWords(value: number): string {
  const n = Math.floor(value);
  if (n === 0) return 'zéro';
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  if (millions > 0) parts.push(millions === 1 ? 'un million' : `${under1000(millions)} millions`);
  if (thousands > 0) parts.push(thousands === 1 ? 'mille' : `${under1000(thousands)} mille`);
  if (rest > 0) parts.push(under1000(rest));
  const joined = parts.join(' ');
  if (rest > 0 && rest % 100 === 0 && rest >= 200) {
    return joined.replace(/cent$/, 'cents');
  }
  return joined;
}
