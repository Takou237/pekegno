import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { currentLocale } from '@/i18n';
import { currencyLabel, formatNumber, numberToWords } from '@/utils/number';
import type { Invoice } from '@/types/invoice';
import logoUrl from '@/assets/pekegno-logo.png';

// XAF et XOF sont tous deux des francs CFA ; les autres monnaies gardent leur code.
export function currencyWords(code?: string | null): string {
  return !code || code === 'XAF' || code === 'XOF' ? 'Francs CFA' : code;
}

function shortDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(currentLocale(), { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

export const BLUE = '#00AEEF';

/**
 * Facture imprimable reproduisant le modèle PEKEGNO (FACTURE PEKEGNO academy.docx) :
 * logo + coordonnées de l'entité du pays, bandeau DESTINATAIRE, tableau
 * Désignation / Description / Période / Prix, total en lettres, moyens de
 * paiement, cachet de la direction et pied de page légal (NUI...).
 * Les informations de l'entité se règlent dans la fiche du pays.
 */
export function InvoicePrint({ invoice }: { invoice: Invoice }) {
  const print = invoice.print;
  const issuer = print?.issuer;
  const recipient = print?.recipient;
  const cur = currencyLabel(invoice.currency_code);
  const total = Number(invoice.total_amount);
  const discount = Number(invoice.discount);
  const vat = Number(invoice.vat_amount);
  const itemInfo = new Map((print?.items ?? []).map((i) => [i.id, i]));
  const accounts = issuer?.payment_accounts ?? [];

  return (
    <div className="bg-white px-10 py-8 text-[13px] leading-snug text-gray-900" style={{ fontFamily: 'Verdana, Arial, sans-serif' }}>
      {/* En-tête : logo à gauche, coordonnées de l'entité à droite */}
      <div className="flex items-start justify-between gap-6">
        <img src={logoUrl} alt="PEKEGNO" className="h-12 w-auto" />
        <div className="max-w-[60%] whitespace-pre-line text-right text-xs text-gray-500">
          {issuer?.company_name && <p className="font-semibold text-gray-600">{issuer.company_name}</p>}
          {issuer?.header_lines}
        </div>
      </div>

      <div className="mt-8 text-right">
        <p className="text-lg font-bold" style={{ color: BLUE }}>FACTURE {invoice.number}</p>
        <p className="text-xs">{new Date(invoice.invoice_date).toLocaleDateString(currentLocale())}</p>
      </div>

      {/* Destinataire */}
      <div className="mt-4">
        <p className="inline-block px-4 py-1 text-xs font-bold text-white" style={{ background: BLUE, minWidth: '14rem' }}>DESTINATAIRE</p>
        <div className="mt-2 space-y-0.5 pl-6">
          <p>Nom : <strong>{recipient?.name ?? invoice.client_label ?? '—'}</strong></p>
          {recipient?.country && <p>Pays : <strong>{recipient.country}</strong></p>}
          {recipient?.phone && <p>Téléphone : <strong>{recipient.phone}</strong></p>}
          {recipient?.email && <p>E-mail : {recipient.email}</p>}
        </div>
      </div>

      {/* Lignes */}
      <table className="mt-4 w-full border-collapse border border-gray-800 text-xs">
        <colgroup>
          <col style={{ width: '22%' }} />
          <col style={{ width: '28%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '17%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className="border border-gray-800 px-2 py-1 text-left">Désignation</th>
            <th className="border border-gray-800 px-2 py-1 text-left">Description</th>
            <th className="border border-gray-800 px-2 py-1">Période</th>
            <th className="border border-gray-800 px-2 py-1 text-right">Prix Unitaire<br />({cur})</th>
            <th className="border border-gray-800 px-2 py-1 text-right">Prix Total<br />({cur})</th>
          </tr>
        </thead>
        <tbody>
          {(invoice.items ?? []).map((item) => {
            const info = itemInfo.get(item.id);
            return (
              <tr key={item.id} className="align-top">
                <td className="border border-gray-800 px-2 py-2 font-bold">
                  {item.label}
                  {item.quantity > 1 && <span className="font-normal"> × {item.quantity}</span>}
                  {item.pass_label && <span className="block font-normal text-gray-600">({item.pass_label})</span>}
                </td>
                <td className="whitespace-pre-line border border-gray-800 px-2 py-2">{info?.description ?? ''}</td>
                <td className="border border-gray-800 px-2 py-2 text-center text-[11px]">
                  {info?.period_start && (
                    <>
                      Du {shortDate(info.period_start)}
                      {info.period_end && <><br />Au {shortDate(info.period_end)}</>}
                    </>
                  )}
                </td>
                <td className="border border-gray-800 px-2 py-2 text-right">{formatNumber(item.unit_price)}</td>
                <td className="border border-gray-800 px-2 py-2 text-right">{formatNumber(item.line_total)}</td>
              </tr>
            );
          })}
          {discount > 0 && (
            <tr>
              <td colSpan={4} className="border border-gray-800 px-2 py-1 text-right">Remise</td>
              <td className="border border-gray-800 px-2 py-1 text-right">- {formatNumber(discount)}</td>
            </tr>
          )}
          {vat > 0 && (
            <tr>
              <td colSpan={4} className="border border-gray-800 px-2 py-1 text-right">TVA ({invoice.vat_rate} %)</td>
              <td className="border border-gray-800 px-2 py-1 text-right">+ {formatNumber(vat)}</td>
            </tr>
          )}
          <tr>
            <td colSpan={4} className="border border-gray-800 px-2 py-1 text-right font-bold">TOTAL</td>
            <td className="border border-gray-800 px-2 py-1 text-right font-bold text-red-600">{formatNumber(total)} {cur}</td>
          </tr>
          {Number(invoice.amount_paid) > 0 && Number(invoice.balance_due) > 0 && (
            <>
              <tr>
                <td colSpan={4} className="border border-gray-800 px-2 py-1 text-right">Déjà payé</td>
                <td className="border border-gray-800 px-2 py-1 text-right">{formatNumber(invoice.amount_paid)}</td>
              </tr>
              <tr>
                <td colSpan={4} className="border border-gray-800 px-2 py-1 text-right font-semibold">Reste à payer</td>
                <td className="border border-gray-800 px-2 py-1 text-right font-semibold">{formatNumber(invoice.balance_due)}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      <p className="mt-4 pl-6" style={{ fontFamily: 'Times New Roman, serif', fontSize: '14px' }}>
        Arrêter la présente facture à la somme{vat > 0 ? ' TTC' : ' Hors Taxes'} de{' '}
        <strong>
          {formatNumber(total)} ({numberToWords(total)}) {currencyWords(invoice.currency_code)}
        </strong>
        .
      </p>

      {/* Moyens de paiement */}
      {accounts.length > 0 && (
        <table className="mt-4 w-full border-collapse border border-gray-800 text-[11px]">
          <thead>
            <tr>
              <th colSpan={3} className="px-2 py-0.5 text-left font-bold text-white" style={{ background: BLUE }}>MOYENS DE PAIEMENT</th>
            </tr>
            <tr>
              <th className="border border-gray-800 px-2 py-0.5 text-left">Compte</th>
              <th className="border border-gray-800 px-2 py-0.5 text-left">Coordonnées</th>
              <th className="border border-gray-800 px-2 py-0.5 text-left">Intitulé</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a, i) => (
              <tr key={i}>
                <td className="border border-gray-800 px-2 py-0.5 font-bold" style={{ color: ['#E3000F', '#F7931E', '#FFB400'][i % 3] }}>{a.label}</td>
                <td className="border border-gray-800 px-2 py-0.5">{a.details}</td>
                <td className="border border-gray-800 px-2 py-0.5">{a.holder ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Cachet / signature */}
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

/**
 * Copie imprimable placée directement dans <body>, hors de toute modale : la
 * fenêtre d'aperçu défile, et imprimer son contenu coupait la facture.
 * Invisible à l'écran, seule visible à l'impression (voir index.css).
 */
export function PrintPortal({ children }: { children: ReactNode }) {
  return createPortal(<div id="invoice-print">{children}</div>, document.body);
}

export function InvoicePrintPortal({ invoice }: { invoice: Invoice }) {
  return (
    <PrintPortal>
      <InvoicePrint invoice={invoice} />
    </PrintPortal>
  );
}
