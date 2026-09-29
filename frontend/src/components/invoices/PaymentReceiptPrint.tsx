import { currentLocale } from '@/i18n';
import { currencyLabel, formatNumber, numberToWords } from '@/utils/number';
import type { Invoice, InvoicePayment, PaymentMethod } from '@/types/invoice';
import logoUrl from '@/assets/pekegno-logo.png';
import { BLUE, currencyWords } from '@/components/invoices/InvoicePrint';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  om: 'Orange Money',
  momo: 'MTN Mobile Money',
  mobile: 'Mobile Money',
};

/**
 * Reçu imprimable d'un versement. La facture ne s'imprime qu'une fois
 * soldée ; chaque versement (acompte, tranche, solde) a en revanche son reçu,
 * avec le cumul versé et le reste à payer à la date de ce versement.
 * Même en-tête, cachet et pied de page que la facture (fiche du pays).
 */
export function PaymentReceiptPrint({ invoice, payment }: { invoice: Invoice; payment: InvoicePayment }) {
  const issuer = invoice.print?.issuer;
  const recipient = invoice.print?.recipient;
  const cur = currencyLabel(invoice.currency_code);
  const total = Number(invoice.total_amount);
  const amount = Number(payment.amount);

  // Les versements arrivent triés par date (GET /invoices/{id}) : cumul jusqu'à celui-ci inclus.
  const payments = invoice.payments ?? [];
  const index = payments.findIndex((p) => p.id === payment.id);
  const paidBefore = payments.slice(0, Math.max(index, 0)).reduce((sum, p) => sum + Number(p.amount), 0);
  const paidToDate = paidBefore + amount;
  const remaining = Math.max(total - paidToDate, 0);

  const receiver = payment.receiver
    ? [payment.receiver.first_name, payment.receiver.last_name].filter(Boolean).join(' ') || payment.receiver.email
    : null;

  const row = (label: string, value: string, strong = false) => (
    <tr>
      <td className={`border border-gray-800 px-3 py-1.5 ${strong ? 'font-bold' : ''}`}>{label}</td>
      <td className={`border border-gray-800 px-3 py-1.5 text-right ${strong ? 'font-bold' : ''}`}>{value}</td>
    </tr>
  );

  return (
    <div className="bg-white px-10 py-8 text-[13px] leading-snug text-gray-900" style={{ fontFamily: 'Verdana, Arial, sans-serif' }}>
      <div className="flex items-start justify-between gap-6">
        <img src={logoUrl} alt="PEKEGNO" className="h-12 w-auto" />
        <div className="max-w-[60%] whitespace-pre-line text-right text-xs text-gray-500">
          {issuer?.company_name && <p className="font-semibold text-gray-600">{issuer.company_name}</p>}
          {issuer?.header_lines}
        </div>
      </div>

      <div className="mt-8 text-right">
        <p className="text-lg font-bold" style={{ color: BLUE }}>REÇU DE VERSEMENT {payment.receipt_number ?? ''}</p>
        <p className="text-xs">
          {new Date(payment.paid_at).toLocaleDateString(currentLocale())} — Facture {invoice.number}
        </p>
      </div>

      <div className="mt-4">
        <p className="inline-block px-4 py-1 text-xs font-bold text-white" style={{ background: BLUE, minWidth: '14rem' }}>REÇU DE</p>
        <div className="mt-2 space-y-0.5 pl-6">
          <p>Nom : <strong>{recipient?.name ?? invoice.client_label ?? '—'}</strong></p>
          {recipient?.phone && <p>Téléphone : <strong>{recipient.phone}</strong></p>}
          {recipient?.email && <p>E-mail : {recipient.email}</p>}
        </div>
      </div>

      <p className="mt-5 pl-6" style={{ fontFamily: 'Times New Roman, serif', fontSize: '14px' }}>
        La somme de{' '}
        <strong>
          {formatNumber(amount)} ({numberToWords(amount)}) {currencyWords(invoice.currency_code)}
        </strong>
        , au titre de : {(invoice.items ?? []).map((i) => i.label).join(', ') || `facture ${invoice.number}`}.
      </p>

      <table className="mt-4 w-full border-collapse border border-gray-800 text-xs">
        <tbody>
          {row('Mode de paiement', METHOD_LABELS[payment.payment_method] ?? payment.payment_method)}
          {payment.treasury_account?.name && row('Compte', payment.treasury_account.name)}
          {receiver && row('Encaissé par', receiver)}
          {payment.comment && row('Commentaire', payment.comment)}
          {row(`Montant total de la facture (${cur})`, formatNumber(total))}
          {row(`Déjà versé avant ce reçu (${cur})`, formatNumber(paidBefore))}
          {row(`Montant de ce versement (${cur})`, formatNumber(amount), true)}
          {row(`Total versé à ce jour (${cur})`, formatNumber(paidToDate))}
          <tr>
            <td className="border border-gray-800 px-3 py-1.5 font-bold">Reste à payer ({cur})</td>
            <td className="border border-gray-800 px-3 py-1.5 text-right font-bold text-red-600">{formatNumber(remaining)}</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-3 text-xs italic text-gray-600">
        {remaining > 0
          ? 'Reçu de versement partiel — ne vaut pas facture acquittée. La facture sera remise après paiement complet.'
          : 'Ce versement solde la facture.'}
      </p>

      <div className="mt-6 flex justify-end">
        {issuer?.stamp_url ? (
          <img src={issuer.stamp_url} alt="La Direction" className="h-40 w-auto" />
        ) : (
          <p className="mr-16 font-semibold underline">La Direction</p>
        )}
      </div>

      {issuer?.footer_lines && (
        <div className="mt-10 whitespace-pre-line text-center text-xs text-gray-700">{issuer.footer_lines}</div>
      )}
    </div>
  );
}
