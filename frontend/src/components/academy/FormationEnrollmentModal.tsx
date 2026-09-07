import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { academyApi, type Course, type TrainingSession } from '@/api/academy.api';
import { commercialsApi } from '@/api/commercials.api';
import { employeesApi } from '@/api/employees.api';
import { clientsApi } from '@/api/clients.api';
import { EnrollmentLearnerField, emptyNewLearnerForm, type LearnerMode, type NewLearnerFormState } from '@/components/academy/EnrollmentLearnerField';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { currentLocale } from '@/i18n';
import type { FormationEnrollment, FormationEnrollmentPayload } from '@/types/formation';

const SELLER_TRAINER_PREFIX = 'trainer:';

interface FormationEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agencyId?: string;
  onSaved: (enrollment: FormationEnrollment) => void;
}

interface FormState {
  course_id: string;
  learner_user_id: string;
  seller_user_id: string;
  seller_trainer_id: string;
  training_session_id: string;
  amount_paid: string;
  notes: string;
}

const emptyForm: FormState = {
  course_id: '',
  learner_user_id: '',
  seller_user_id: '',
  seller_trainer_id: '',
  training_session_id: '',
  amount_paid: '',
  notes: '',
};

export default function FormationEnrollmentModal({
  isOpen,
  onClose,
  agencyId,
  onSaved,
}: FormationEnrollmentModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [learnerMode, setLearnerMode] = useState<LearnerMode>('existing');
  const [newLearner, setNewLearner] = useState<NewLearnerFormState>(emptyNewLearnerForm);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollSessions, setEnrollSessions] = useState<TrainingSession[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyForm);
      setLearnerMode('existing');
      setNewLearner(emptyNewLearnerForm);
      setFormError(null);
      setFieldErrors({});
      setCourses([]);
      setEnrollSessions([]);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !agencyId) return;
    let active = true;
    academyApi
      .courses({ agency_id: agencyId, per_page: 100 })
      .then((res) => {
        if (active) setCourses(res.data);
      })
      .catch(() => {
        if (active) setCourses([]);
      });
    return () => {
      active = false;
    };
  }, [isOpen, agencyId]);

  useEffect(() => {
    if (!form.course_id || !agencyId) {
      setEnrollSessions([]);
      return;
    }
    setEnrollSessions([]);
    let active = true;
    academyApi
      .sessions({ agency_id: agencyId, course_id: form.course_id, per_page: 100 })
      .then((res) => {
        if (active) {
          setEnrollSessions(
            res.data.filter(
              (s) =>
                s.status !== 'cancelled' &&
                s.status !== 'completed' &&
                (s.end_at === null || new Date(s.end_at) >= new Date()),
            ),
          );
        }
      })
      .catch(() => {
        if (active) setEnrollSessions([]);
      });
    return () => {
      active = false;
    };
  }, [form.course_id, agencyId]);

  const selectedCourse = useCallback(
    (courseId: string) => courses.find((c) => c.id === courseId) ?? null,
    [courses],
  );

  const learnerOptions = useCallback(
    async (query: string) => {
      if (!agencyId) return [];
      const q = query.trim();
      const response = await academyApi.learners({
        agency_id: agencyId,
        search: q || undefined,
        per_page: q ? 50 : 100,
      });
      return response.data.map((learner) => {
        const fullName =
          [learner.learner?.first_name, learner.learner?.last_name].filter(Boolean).join(' ') ||
          learner.learner?.email ||
          '';
        return {
          id: learner.id,
          label: fullName,
          subtitle: [learner.learner?.client_number, learner.learner?.email]
            .filter(Boolean)
            .join(' — '),
        };
      });
    },
    [agencyId],
  );

  const sellerOptions = useCallback(
    async (query: string) => {
      if (!agencyId) return [];
      type SellerEntry = {
        user_id: string;
        name: string;
        email: string;
        kind: 'commercial' | 'employe' | 'trainer';
      };
      const [commercials, employees, trainers] = await Promise.all([
        commercialsApi.list({ agency_id: agencyId, per_page: 100 }),
        employeesApi.list({ agency_id: agencyId, per_page: 100 }),
        academyApi.trainers({ agency_id: agencyId, per_page: 100 }),
      ]);
      const entries: SellerEntry[] = [
        ...commercials.data.map((c) => ({ user_id: c.user_id, name: `${c.first_name} ${c.last_name}`.trim(), email: c.email ?? '', kind: 'commercial' as const })),
        ...employees.data.map((e) => ({ user_id: e.user_id, name: `${e.first_name} ${e.last_name}`.trim(), email: e.email ?? '', kind: 'employe' as const })),
        ...trainers.data
          .filter((tr) => tr.user_id)
          .map((tr) => ({
            user_id: tr.user_id as string,
            name: [tr.first_name, tr.last_name].filter(Boolean).join(' ').trim(),
            email: tr.email ?? '',
            kind: 'trainer' as const,
          })),
        ...trainers.data
          .filter((tr) => !tr.user_id && tr.id)
          .map((tr) => ({
            user_id: SELLER_TRAINER_PREFIX + tr.id,
            name: [tr.first_name, tr.last_name].filter(Boolean).join(' ').trim(),
            email: tr.email ?? '',
            kind: 'trainer' as const,
          })),
      ].filter((o): o is SellerEntry => Boolean(o.user_id));

      const all = Array.from(
        new Map(entries.map((entry) => [entry.user_id, entry])).values(),
      );

      const q = query.trim().toLowerCase();
      const filtered = q
        ? all.filter((o) => o.name.toLowerCase().includes(q) || o.email.toLowerCase().includes(q))
        : all;
      return filtered.map((o) => {
        const kindLabel =
          o.kind === 'trainer'
            ? t('academy.trainer')
            : o.kind === 'employe'
              ? t('academy.employee')
              : t('academy.commercial');
        return {
          id: o.user_id,
          label: o.name || o.email || o.user_id,
          subtitle: [o.email, kindLabel].filter(Boolean).join(' · '),
        };
      });
    },
    [agencyId, t],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!agencyId) return;
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      let learnerUserId = form.learner_user_id;
      if (learnerMode === 'new') {
        if (!newLearner.first_name || !newLearner.last_name || !newLearner.email) {
          setFormError(t('academy.newLearnerRequired'));
          setIsSubmitting(false);
          return;
        }
        const created = await clientsApi.create({
          first_name: newLearner.first_name,
          last_name: newLearner.last_name,
          email: newLearner.email,
          phone: newLearner.phone || null,
          registered_agency_id: agencyId,
        });
        learnerUserId = created.id;
      }

      const payload: FormationEnrollmentPayload = {
        course_id: form.course_id,
        learner_user_id: learnerUserId,
        seller_user_id: form.seller_user_id || undefined,
        seller_trainer_id: form.seller_trainer_id || undefined,
        ...(form.training_session_id ? { training_session_id: form.training_session_id } : {}),
        ...(form.amount_paid ? { amount_paid: Number(form.amount_paid) } : {}),
        notes: form.notes || undefined,
      };

      const saved = await academyApi.createFormationEnrollment(payload);
      showToast(t('academy.enrollmentCreated'), 'success');
      onSaved(saved);
      onClose();
    } catch (error) {
      setFormError(extractErrorMessage(error, t('academy.saveFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('academy.newEnrollment')} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('nav.courses')} *
          </label>
          <select
            value={form.course_id}
            onChange={(e) => setForm((prev) => ({ ...prev, course_id: e.target.value, training_session_id: '' }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="">{t('academy.searchCoursePlaceholder')}</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name} — {course.effective_price != null ? `${Number(course.effective_price).toLocaleString()} FCFA` : course.price != null ? `${Number(course.price).toLocaleString()} FCFA` : '—'}
              </option>
            ))}
          </select>
          {fieldErrors.course_id && (
            <p className="mt-1 text-sm text-error-500">{fieldErrors.course_id}</p>
          )}
          {(selectedCourse(form.course_id)?.effective_price != null || selectedCourse(form.course_id)?.price != null) && (
            <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              {t('academy.priceToPay', {
                amount: Number(
                  selectedCourse(form.course_id)?.effective_price ?? selectedCourse(form.course_id)?.price,
                ).toLocaleString(),
              })}
            </p>
          )}
        </div>

        {form.course_id && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {`${t('academy.session')} *`}
            </label>
            <select
              required
              value={form.training_session_id}
              onChange={(e) => setForm((prev) => ({ ...prev, training_session_id: e.target.value }))}
              className={`w-full rounded-lg border px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 ${
                fieldErrors.training_session_id ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">{t('academy.selectSession')}</option>
              {enrollSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {`${t('academy.session')} — ${new Date(session.start_at).toLocaleDateString(currentLocale())}${session.max_capacity != null ? ` (${session.enrollments_count ?? 0}/${session.max_capacity})` : ''}`}
                </option>
              ))}
            </select>
            {enrollSessions.length === 0 && (
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {t('academy.noSessionsForCourse')}
              </p>
            )}
            {fieldErrors.training_session_id && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.training_session_id}</p>
            )}
          </div>
        )}

        <EnrollmentLearnerField
          mode={learnerMode}
          onModeChange={setLearnerMode}
          learnerUserId={form.learner_user_id}
          onLearnerUserIdChange={(userId) => setForm((prev) => ({ ...prev, learner_user_id: userId }))}
          fetchOptions={learnerOptions}
          newLearner={newLearner}
          onNewLearnerChange={setNewLearner}
          error={fieldErrors.learner_user_id}
          allowCreate
        />

        <Autocomplete
          label={t('academy.seller')}
          placeholder={t('academy.searchSellerPlaceholder')}
          value={form.seller_trainer_id
            ? SELLER_TRAINER_PREFIX + form.seller_trainer_id
            : form.seller_user_id}
          onChange={(id) =>
            setForm((prev) =>
              id.startsWith(SELLER_TRAINER_PREFIX)
                ? { ...prev, seller_trainer_id: id.slice(SELLER_TRAINER_PREFIX.length), seller_user_id: '' }
                : { ...prev, seller_user_id: id, seller_trainer_id: '' },
            )
          }
          fetchOptions={sellerOptions}
          error={fieldErrors.seller_user_id}
        />

        <Input
          label={`${t('academy.amountPaid')} (FCFA)`}
          type="number"
          min={0}
          placeholder="0"
          value={form.amount_paid}
          onChange={(e) => setForm((prev) => ({ ...prev, amount_paid: e.target.value }))}
          error={fieldErrors.amount_paid}
          hint={t('academy.amountPaidHint')}
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('common.notes')}
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={isSubmitting} className="flex-1">
            {t('common.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
