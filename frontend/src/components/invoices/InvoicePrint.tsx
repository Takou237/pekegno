import { useTranslation } from 'react-i18next';
import { currentLocale } from '@/i18n';
import type { Invoice } from '@/types/invoice';

function formatCurrency(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`;
}

export function InvoicePrint({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation();
  const agency = invoice.agency_snapshot;

  return (
    <div id="invoice-print" className="bg-white p-8 text-gray-900">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PEKEGNO</h1>
          {agency && (
            <div className="mt-1 text-sm text-gray-600">
              <p className="font-semibold">{agency.name}</p>
              {agency.address && <p>{agency.address}</p>}
              {agency.city && <p>{agency.city}</p>}
              {agency.phone && <p>{agency.phone}</p>}
              {agency.email && <p>{agency.email}</p>}
            </div>
          )}
        </div>
        <div className="text-right">
          <h2 className="text-lg font-semibold">{t('invoices.title')}</h2>
          <p className="mt-1 text-sm font-medium text-gray-800">{invoice.number}</p>
          <p className="text-sm text-gray-600">
            {t('invoices.invoiceDate')} :{' '}
            {new Date(invoice.invoice_date).toLocaleDateString(currentLocale())}
          </p>
        </div>
      </div>

      <div className="mt-8 flex justify-end text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {t('invoices.clientLabel')}
          </p>
          {invoice.client ? (
            <div className="mt-1 text-right text-gray-800">
              <p className="font-medium">
                {[invoice.client.first_name, invoice.client.last_name]
                  .filter(Boolean)
                  .join(' ')}
              </p>
              <p>{invoice.client.email}</p>
              {invoice.client.phone && <p>{invoice.client.phone}</p>}
            </div>
          ) : (
            <p className="mt-1 text-gray-500">—</p>
          )}
        </div>
      </div>

      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-900 text-left">
            <th className="py-2 pr-3 font-semibold">{t('invoices.itemLabel')}</th>
            <th className="py-2 pr-3 text-right font-semibold">{t('invoices.quantity')}</th>
            <th className="py-2 pr-3 text-right font-semibold">{t('invoices.unitPrice')}</th>
            <th className="py-2 text-right font-semibold">{t('invoices.lineTotal')}</th>
          </tr>
        </thead>
        <tbody>
          {(invoice.items ?? []).map((item) => (
            <tr key={item.id} className="border-b border-gray-200">
              <td className="py-2 pr-3">{item.label}</td>
              <td className="py-2 pr-3 text-right">{item.quantity}</td>
              <td className="py-2 pr-3 text-right">{formatCurrency(item.unit_price)}</td>
              <td className="py-2 text-right">{formatCurrency(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 ml-auto w-64 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-gray-600">{t('invoices.totalAfterDiscount')}</span>
          <span className="text-gray-800">{formatCurrency(Number(invoice.total_amount) + Number(invoice.discount) - Number(invoice.vat_amount))}</span>
        </div>
        {Number(invoice.discount) > 0 && (
          <div className="flex justify-between py-1">
            <span className="text-gray-600">{t('invoices.discountLabel')}</span>
            <span className="text-gray-800">- {formatCurrency(invoice.discount)}</span>
          </div>
        )}
        {Number(invoice.vat_rate) > 0 && (
          <div className="flex justify-between py-1">
            <span className="text-gray-600">
              {t('invoices.vatAmount')} ({invoice.vat_rate}%)
            </span>
            <span className="text-gray-800">+ {formatCurrency(invoice.vat_amount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-300 py-1">
          <span className="font-semibold">{t('invoices.totalAmount')}</span>
          <span className="font-semibold">{formatCurrency(invoice.total_amount)}</span>
        </div>
        {Number(invoice.amount_paid) > 0 && (
          <div className="flex justify-between py-1">
            <span className="text-gray-600">{t('invoices.paidAmount')}</span>
            <span className="text-gray-800">- {formatCurrency(invoice.amount_paid)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-300 py-1">
          <span className="font-semibold">{t('invoices.balanceDue')}</span>
          <span className="font-semibold">{formatCurrency(invoice.balance_due)}</span>
        </div>
      </div>

      {invoice.comment && (
        <p className="mt-8 text-sm text-gray-600">
          {t('invoices.headerComment')} : {invoice.comment}
        </p>
      )}
    </div>
  );
}
