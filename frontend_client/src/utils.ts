export function formatCurrency(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return '0 FCFA';
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n) + ' FCFA';
}

export function displayPrice(item: { type: 'service' | 'product' | 'course'; price?: number | string; effective_price?: number | string; selling_price?: number | string; price_with_tax?: number | string }): number {
  if (item.type === 'service' || item.type === 'course') {
    const ep = item.effective_price ?? item.price ?? 0;
    return typeof ep === 'string' ? parseFloat(ep) : ep;
  }
  const sp = item.selling_price ?? item.price_with_tax ?? 0;
  return typeof sp === 'string' ? parseFloat(sp) : sp;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
