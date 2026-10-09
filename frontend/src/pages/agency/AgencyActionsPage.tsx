import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AgencyActionsBoardPage, { type ActionsBoardMode } from '@/pages/agency/AgencyActionsBoardPage';
import { ACTION_TYPES } from '@/types/agencyDepartment';

const TABS: ActionsBoardMode[] = ['all', ...ACTION_TYPES];

/**
 * Suivi des actions regroupé en un seul menu : Toutes + un onglet par type
 * d'action (community, publicité, production, coaching, stratégie, autres).
 * Les anciennes routes /community et /advertising restent accessibles.
 */
export default function AgencyActionsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<ActionsBoardMode>('all');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 overflow-x-auto border-b border-gray-100 dark:border-gray-800">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === id
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {id === 'all' ? t('common.all') : t(`agencyDept.actionType.${id}`)}
          </button>
        ))}
      </div>

      <AgencyActionsBoardPage key={tab} mode={tab} />
    </div>
  );
}
