import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PendingInvoicesPage from '@/pages/invoices/PendingInvoicesPage';
import PaymentProofsPage from '@/pages/invoices/PaymentProofsPage';

/**
 * Page unique « Paiements à valider » : regroupe les factures en attente de
 * validation et les preuves de paiement à examiner dans deux onglets.
 */
export default function ValidationsPage({
  fixedCountryId,
  fixedAgencyId,
  fixedDepartmentId,
}: {
  fixedCountryId?: string;
  fixedAgencyId?: string;
  fixedDepartmentId?: string;
} = {}) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = searchParams.get('tab') === 'invoices' ? 'invoices' : 'proofs';

  function setTab(next: 'invoices' | 'proofs') {
    const params = new URLSearchParams(searchParams);
    if (next === 'invoices') params.set('tab', 'invoices');
    else params.delete('tab');
    setSearchParams(params, { replace: true });
  }

  const tabClass = (active: boolean) =>
    `border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
      active
        ? 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
    }`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('invoices.paymentProofsTitlePage')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('invoices.validationsSubtitle')}</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        <button type="button" className={tabClass(tab === 'invoices')} onClick={() => setTab('invoices')}>
          {t('invoices.validationsTabInvoices')}
        </button>
        <button type="button" className={tabClass(tab === 'proofs')} onClick={() => setTab('proofs')}>
          {t('invoices.validationsTabProofs')}
        </button>
      </div>

      {tab === 'invoices' ? (
        <PendingInvoicesPage
          embedded
          fixedCountryId={fixedCountryId}
          fixedAgencyId={fixedAgencyId}
          departmentId={fixedDepartmentId}
        />
      ) : (
        <PaymentProofsPage
          embedded
          fixedCountryId={fixedCountryId}
          fixedAgencyId={fixedAgencyId}
          fixedDepartmentId={fixedDepartmentId}
        />
      )}
    </div>
  );
}
