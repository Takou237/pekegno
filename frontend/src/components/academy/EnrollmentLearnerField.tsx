import { useTranslation } from 'react-i18next';
import { UserPlus } from 'lucide-react';
import { Autocomplete, type AutocompleteOption } from '@/components/ui/Autocomplete';
import { Input } from '@/components/ui/Input';

export type LearnerMode = 'existing' | 'new';

export interface NewLearnerFormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export const emptyNewLearnerForm: NewLearnerFormState = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
};

interface EnrollmentLearnerFieldProps {
  mode: LearnerMode;
  onModeChange: (mode: LearnerMode) => void;
  learnerUserId: string;
  onLearnerUserIdChange: (id: string) => void;
  fetchOptions: (query: string) => Promise<AutocompleteOption[]>;
  newLearner: NewLearnerFormState;
  onNewLearnerChange: (next: NewLearnerFormState) => void;
  error?: string;
  allowCreate?: boolean;
}

export function EnrollmentLearnerField({
  mode,
  onModeChange,
  learnerUserId,
  onLearnerUserIdChange,
  fetchOptions,
  newLearner,
  onNewLearnerChange,
  error,
  allowCreate = true,
}: EnrollmentLearnerFieldProps) {
  const { t } = useTranslation();

  function set<K extends keyof NewLearnerFormState>(key: K, value: string) {
    onNewLearnerChange({ ...newLearner, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3">
      {allowCreate && (
        <div className="flex w-full overflow-hidden rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
          <button
            type="button"
            onClick={() => onModeChange('existing')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === 'existing'
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {t('academy.learnerExisting')}
          </button>
          <button
            type="button"
            onClick={() => onModeChange('new')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === 'new'
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <UserPlus className="h-4 w-4" />
            {t('academy.learnerCreateNew')}
          </button>
        </div>
      )}

      {mode === 'existing' ? (
        <Autocomplete
          label={`${t('academy.learner')} *`}
          placeholder={t('academy.searchLearnerPlaceholder')}
          value={learnerUserId}
          onChange={onLearnerUserIdChange}
          fetchOptions={fetchOptions}
          error={error}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('academy.newLearnerInfo')}
          </span>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('common.firstName')}
              required
              value={newLearner.first_name}
              onChange={(e) => set('first_name', e.target.value)}
            />
            <Input
              label={t('common.lastName')}
              required
              value={newLearner.last_name}
              onChange={(e) => set('last_name', e.target.value)}
            />
          </div>
          <Input
            label={t('common.email')}
            type="email"
            required
            value={newLearner.email}
            onChange={(e) => set('email', e.target.value)}
          />
          <Input
            label={t('common.phone')}
            value={newLearner.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500">{t('academy.newLearnerHint')}</p>
          {error && <p className="text-sm text-error-500">{error}</p>}
        </div>
      )}
    </div>
  );
}