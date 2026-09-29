import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { uploadsApi } from '@/api/uploads.api';
import { extractErrorMessage } from '@/api/errors';
import { Input } from '@/components/ui/Input';
import type { CountryInvoiceSettings as Settings } from '@/api/countries.api';

const textareaClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

/**
 * Informations imprimées sur les factures des agences de ce pays : entité
 * légale, coordonnées, pied de page (NUI, RCCM...), comptes de paiement et
 * cachet de la direction.
 */
export function CountryInvoiceSettings({ value, onChange }: { value: Settings; onChange: (v: Settings) => void }) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const accounts = value.payment_accounts ?? [];

  function set<K extends keyof Settings>(key: K, v: Settings[K]) {
    onChange({ ...value, [key]: v });
  }

  function setAccount(index: number, key: 'label' | 'details' | 'holder', v: string) {
    set('payment_accounts', accounts.map((a, i) => (i === index ? { ...a, [key]: v } : a)));
  }

  async function uploadStamp(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await uploadsApi.upload(file);
      set('stamp_url', res.url);
    } catch (error) {
      setUploadError(extractErrorMessage(error, t('countries.invoiceStampFailed')));
    } finally {
      setUploading(false);
    }
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <legend className="px-1 text-sm font-semibold text-gray-700 dark:text-gray-200">{t('countries.invoiceSettings')}</legend>
      <p className="-mt-1 text-xs text-gray-500">{t('countries.invoiceSettingsHint')}</p>

      <Input label={t('countries.invoiceCompanyName')} value={value.company_name ?? ''} onChange={(e) => set('company_name', e.target.value)} placeholder="PEKEGNO Cameroun SARL" />

      <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('countries.invoiceHeaderLines')}
        <textarea rows={4} className={textareaClass} value={value.header_lines ?? ''} onChange={(e) => set('header_lines', e.target.value)}
          placeholder={'Douala – Makepe Saint-Tropez\nTéléphone : +237 ...\nE-mail : services@pekegnodigital.com\nSite web : www.pekegnodigital.com'} />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('countries.invoiceFooterLines')}
        <textarea rows={2} className={textareaClass} value={value.footer_lines ?? ''} onChange={(e) => set('footer_lines', e.target.value)}
          placeholder={'MAKEPE Saint Tropez – Douala – PEKEGNO Cameroun Sarl\nNUI : ...'} />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('countries.invoicePaymentAccounts')}</span>
        {accounts.map((a, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr_1.2fr_auto]">
            <input className={textareaClass} placeholder="Orange Money" value={a.label} onChange={(e) => setAccount(i, 'label', e.target.value)} />
            <input className={textareaClass} placeholder="#150*47*875570*Montant#" value={a.details} onChange={(e) => setAccount(i, 'details', e.target.value)} />
            <input className={textareaClass} placeholder="Pekegno Cameroun Sarl" value={a.holder ?? ''} onChange={(e) => setAccount(i, 'holder', e.target.value)} />
            <button type="button" onClick={() => set('payment_accounts', accounts.filter((_, j) => j !== i))}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800" aria-label={t('common.delete')}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => set('payment_accounts', [...accounts, { label: '', details: '', holder: '' }])}
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
          <Plus className="h-4 w-4" /> {t('countries.invoiceAddAccount')}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('countries.invoiceStamp')}</span>
        <div className="flex items-center gap-3">
          {value.stamp_url && <img src={value.stamp_url} alt="" className="h-16 w-auto rounded border border-gray-200" />}
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(e) => uploadStamp(e.target.files?.[0])} className="text-sm" />
          {value.stamp_url && (
            <button type="button" onClick={() => set('stamp_url', null)} className="text-sm text-error-600 hover:underline">{t('common.delete')}</button>
          )}
        </div>
        {uploadError && <p className="text-sm text-error-500">{uploadError}</p>}
      </div>
    </fieldset>
  );
}
