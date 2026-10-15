// Libellés des seaux de modes de paiement normalisés par le backend
// (cf. App\Support\RevenueService::MODES / byMode).
const LABEL_KEYS: Record<string, string> = {
  cash: 'bilans.cashTotal',
  om: 'bilans.omTotal',
  momo: 'bilans.momoTotal',
  mobile: 'bilans.mobileTotal',
  bank: 'bilans.bankTotal',
};

export function paymentMethodLabel(method: string, t: (key: string) => string): string {
  const key = LABEL_KEYS[method];

  return key ? t(key) : method;
}
