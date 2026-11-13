import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { academyApi, type SessionModuleTrainerRow } from '@/api/academy.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Autocomplete } from '@/components/ui/Autocomplete';

interface Props {
  sessionId: string | null;
  onClose: () => void;
}

const fullName = (t: { first_name?: string | null; last_name?: string | null; email?: string | null }) =>
  [t.first_name, t.last_name].filter(Boolean).join(' ') || t.email || '—';

/**
 * Formateur de chaque module pour UNE session (facultatif). Un formateur
 * confié ici ne voit que cette session et ce module, pas les autres
 * sessions de la formation.
 */
export default function SessionModuleTrainersModal({ sessionId, onClose }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [rows, setRows] = useState<SessionModuleTrainerRow[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    academyApi
      .sessionModuleTrainers(sessionId)
      .then((data) => {
        setRows(data);
        setValues(Object.fromEntries(data.map((r) => [r.course_module_id, r.trainer?.id ?? ''])));
      })
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))))
      .finally(() => setLoading(false));
  }, [sessionId, t]);

  // Tous les formateurs (un module peut être confié à un formateur d'une autre agence).
  const trainerOptions = useCallback(async (query: string) => {
    const response = await academyApi.trainers({ search: query.trim() || undefined, per_page: 20 });
    return response.data.map((tr) => ({ id: tr.id, label: fullName(tr), subtitle: tr.email ?? undefined }));
  }, []);

  async function save() {
    if (!sessionId) return;
    setSaving(true);
    setError(null);
    try {
      await academyApi.updateSessionModuleTrainers(
        sessionId,
        rows.map((r) => ({ course_module_id: r.course_module_id, trainer_id: values[r.course_module_id] || null })),
      );
      showToast(t('academy.saved'), 'success');
      onClose();
    } catch (e) {
      setError(extractErrorMessage(e, t('academy.saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={Boolean(sessionId)} onClose={onClose} title={t('academy.moduleTrainersTitle')} maxWidth="max-w-lg">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('academy.moduleTrainersHint')}</p>
        {error && <Alert variant="error">{error}</Alert>}
        {loading ? (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('academy.moduleTrainersEmpty')}</p>
        ) : (
          rows.map((row) => (
            <Autocomplete
              key={row.course_module_id}
              label={row.name}
              placeholder={t('academy.searchTrainerPlaceholder')}
              value={values[row.course_module_id] ?? ''}
              onChange={(id) => setValues((prev) => ({ ...prev, [row.course_module_id]: id }))}
              fetchOptions={trainerOptions}
              selectedOption={row.trainer ? { id: row.trainer.id, label: fullName(row.trainer) } : null}
            />
          ))
        )}
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={save} isLoading={saving} disabled={loading || rows.length === 0} className="flex-1">
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
