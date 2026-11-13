import { useEffect, useState } from 'react';
import { client } from '@/api/client';

/** Moyen de paiement : une caisse = un moyen (cf. backend App\Support\PaymentMethods). */
export interface PaymentMethodOption {
  key: string;
  label: string;
  code: string | null;
  type: 'cash' | 'mobile_money' | 'bank';
  requires_phone: boolean;
  has_account: boolean;
}

// Liste de secours tant que la liste du serveur n'est pas chargée.
const FALLBACK: PaymentMethodOption[] = [
  { key: 'cash', label: 'Espèces', code: 'C', type: 'cash', requires_phone: false, has_account: true },
  { key: 'om', label: 'Orange Money', code: 'O', type: 'mobile_money', requires_phone: true, has_account: true },
  { key: 'momo', label: 'MTN MoMo', code: 'M', type: 'mobile_money', requires_phone: true, has_account: true },
  { key: 'wave', label: 'Wave', code: 'W', type: 'mobile_money', requires_phone: true, has_account: true },
];

const cache = new Map<string, Promise<PaymentMethodOption[]>>();
const known = new Map<string, PaymentMethodOption>(FALLBACK.map((m) => [m.key, m]));

function load(agencyId?: string | null): Promise<PaymentMethodOption[]> {
  const cacheKey = agencyId || '*';
  if (!cache.has(cacheKey)) {
    cache.set(
      cacheKey,
      client
        .get<PaymentMethodOption[]>('/payment-methods', { params: agencyId ? { agency_id: agencyId } : undefined })
        .then(({ data }) => {
          data.forEach((m) => known.set(m.key, m));
          return data;
        })
        .catch(() => {
          cache.delete(cacheKey);
          return FALLBACK;
        }),
    );
  }
  return cache.get(cacheKey)!;
}

/** À appeler après la création / modification d'une caisse. */
export function invalidatePaymentMethods(): void {
  cache.clear();
}

/** Moyens de paiement de l'agence (ou du réseau). */
export function usePaymentMethods(agencyId?: string | null): PaymentMethodOption[] {
  const [methods, setMethods] = useState<PaymentMethodOption[]>(FALLBACK);

  useEffect(() => {
    let active = true;
    load(agencyId).then((data) => active && setMethods(data));
    return () => {
      active = false;
    };
  }, [agencyId]);

  return methods;
}

/** Le moyen exige-t-il le numéro du payeur (paiement mobile) ? */
export function requiresPayerPhone(method?: string | null): boolean {
  if (!method) return false;
  return known.get(method)?.requires_phone ?? ['om', 'momo', 'wave', 'moov', 'mobile'].includes(method);
}

/** Libellé d'un moyen de paiement (caisses créées comprises). */
export function paymentMethodName(method?: string | null): string {
  if (!method) return '—';
  return known.get(method)?.label ?? method;
}

/** Options d'un <select> de moyen de paiement : une par caisse de l'agence. */
export function PaymentMethodOptions({ agencyId }: { agencyId?: string | null }) {
  const methods = usePaymentMethods(agencyId);

  return (
    <>
      {methods.map((m) => (
        <option key={m.key} value={m.key}>
          {m.label}
        </option>
      ))}
    </>
  );
}
