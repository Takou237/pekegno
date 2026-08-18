import { useTranslation } from 'react-i18next';
import { currentLocale } from '@/i18n';
import { formatCurrency, formatNumber, numberToWords } from '@/utils/number';
import type { Invoice } from '@/types/invoice';

export function InvoicePrint({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation();
  const agency = invoice.agency_snapshot;
  const subtotal = Number(invoice.total_amount) + Number(invoice.discount) - Number(invoice.vat_amount);
  const totalTtc = subtotal - Number(invoice.discount);
  const grandTotal = totalTtc + Number(invoice.vat_amount);

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
        <div className="flex flex-col items-end justify-between text-right">
          <div>
            <h2 className="text-lg font-semibold">{t('invoices.title')}</h2>
            <p className="mt-1 text-sm font-medium text-gray-800">{invoice.number}</p>
            <p className="text-sm text-gray-600">
              {t('invoices.invoiceDate')} :{' '}
              {new Date(invoice.invoice_date).toLocaleDateString(currentLocale())}
            </p>
          </div>
          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {t('invoices.clientLabel')}
            </p>
            {invoice.client_label ? (
              <div className="flex flex-col items-end text-gray-800">
                <p className="font-medium">{invoice.client_label}</p>
                {invoice.client && (
                  <>
                    <p className="text-gray-600">{invoice.client.email}</p>
                    {invoice.client.phone && <p className="text-gray-600">{invoice.client.phone}</p>}
                  </>
                )}
              </div>
            ) : (
              <p className="mt-1 text-gray-500">—</p>
            )}
          </div>
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
              <td className="py-2 pr-3">
                {item.label}
                {item.pass_label && (
                  <span className="ml-1 text-xs text-gray-500">({item.pass_label})</span>
                )}
              </td>
              <td className="py-2 pr-3 text-right">{formatNumber(item.quantity)}</td>
              <td className="py-2 pr-3 text-right">{formatCurrency(item.unit_price)}</td>
              <td className="py-2 text-right">{formatCurrency(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 ml-auto w-64 text-sm">
        <div className="flex justify-between py-1">
          <span className="text-gray-600">{t('invoices.totalAfterDiscount')}</span>
          <span className="text-gray-800">{formatCurrency(subtotal)}</span>
        </div>
        {Number(invoice.discount) > 0 && (
          <div className="flex justify-between py-1">
            <span className="text-gray-600">{t('invoices.discountLabel')}</span>
            <span className="text-gray-800">{formatCurrency(invoice.discount)}</span>
          </div>
        )}
        <div className="flex justify-between py-1">
          <span className="text-gray-600">{t('invoices.totalTtc')}</span>
          <span className="text-gray-800">{formatCurrency(totalTtc)}</span>
        </div>
        {Number(invoice.vat_rate) > 0 && (
          <div className="flex justify-between py-1">
            <span className="text-gray-600">
              {t('invoices.vatAmount')} ({invoice.vat_rate}%)
            </span>
            <span className="text-gray-800">{formatCurrency(invoice.vat_amount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-300 py-1">
          <span className="font-semibold">{t('invoices.grandTotalTtc')}</span>
          <span className="font-semibold">{formatCurrency(grandTotal)}</span>
        </div>
      </div>

      {invoice.comment && (
        <p className="mt-8 text-sm text-gray-600">
          {t('invoices.headerComment')} : {invoice.comment}
        </p>
      )}

      <p className="mt-2 text-center text-sm text-gray-800">
        {t('invoices.amountInWords')} {numberToWords(grandTotal)} francs CFA (
        {formatCurrency(grandTotal)}).
      </p>
    </div>
  );
}
