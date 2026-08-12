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
