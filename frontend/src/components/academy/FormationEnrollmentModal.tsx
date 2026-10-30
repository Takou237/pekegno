import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { academyApi, type Course, type TrainingSession } from '@/api/academy.api';
import { clientsApi } from '@/api/clients.api';
import { EnrollmentLearnerField, emptyNewLearnerForm, type LearnerMode, type NewLearnerFormState } from '@/components/academy/EnrollmentLearnerField';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { courseBasePrice, resolveEnrollmentDiscount } from '@/utils/enrollmentDiscount';
import { courseOptionLabel, isOnlineCourse } from '@/utils/courseMode';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { CommercialPicker } from '@/components/agencyDept/Pickers';
import { currentLocale } from '@/i18n';
import { AgencyScopeSelect } from '@/components/common/AgencyScopeSelect';
import type {
  EnrollmentDiscountType,
  FormationEnrollment,
  FormationEnrollmentPayload,
} from '@/types/formation';
import type { PaymentMethod } from '@/types/invoice';
import { currencyLabel } from '@/utils/number';
import { useAgencyCurrency } from '@/hooks/useAgencyCurrency';
import { useOrgContext } from '@/context/OrgContext';


interface FormationEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agencyId?: string;
  /**
   * Inscription depuis un pays (sans agence) : les formations du pays sont
   * proposées et l'agence de travail est celle de la formation choisie.
   */
  countryId?: string;
  /** Cours présélectionné (bouton « Inscrire » depuis une carte de formation). */
  presetCourseId?: string;
  onSaved: (enrollment: FormationEnrollment | null) => void;
}

interface FormState {
  course_id: string;
  learner_user_id: string;
  seller_user_id: string;
  seller_trainer_id: string;
  training_session_id: string;
  amount_paid: string;
  payment_type: '' | PaymentMethod;
  notes: string;
  discount_type: '' | EnrollmentDiscountType;
  discount_value: string;
}

const emptyForm: FormState = {
  course_id: '',
  learner_user_id: '',
  seller_user_id: '',
  seller_trainer_id: '',
  training_session_id: '',
  amount_paid: '',
  payment_type: 'cash',
  notes: '',
  discount_type: '',
  discount_value: '',
};

export default function FormationEnrollmentModal({
  isOpen,
  onClose,
  agencyId: agencyProp,
  countryId,
  presetCourseId,
  onSaved,
}: FormationEnrollmentModalProps) {
  // Le sélecteur d'agence est TOUJOURS affiché : la page présélectionne son
  // agence, l'utilisateur peut la changer — la liste des formations suit le
  // choix, jamais l'agence de la page en dur.
  const [pickedAgencyId, setPickedAgencyId] = useState(agencyProp ?? '');
  // Ouverte depuis une formation précise (agence connue) : agence et
  // formation sont affichées en texte fixe, sans possibilité de les changer.
  const isPreset = Boolean(presetCourseId) && Boolean(agencyProp);
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const isCommercial = currentUser?.role?.name === 'commercial';
  // Commercial et chefs d'agence / de département : l'inscription part en
  // validation, la preuve de paiement est obligatoire.
  const isChief = ['responsable-agence', 'responsable-departement'].includes(currentUser?.role?.name ?? '');
  const needsPaymentProof = isCommercial || isChief;
  const isSellerUser = needsPaymentProof || currentUser?.role?.name === 'caissier';
  const [form, setForm] = useState<FormState>(emptyForm);
  // Un commercial, un caissier ou un responsable d'agence est le vendeur par
  // défaut ; il peut choisir un autre utilisateur dans la liste.
  const sellerValue = form.seller_user_id || (isSellerUser ? currentUser?.id ?? '' : '');
  const currentSellerOption = currentUser
    ? {
        id: currentUser.id,
        label: [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ').trim() || currentUser.name || currentUser.username,
      }
    : null;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [learnerMode, setLearnerMode] = useState<LearnerMode>('existing');
  const [newLearner, setNewLearner] = useState<NewLearnerFormState>(emptyNewLearnerForm);
  const [courses, setCourses] = useState<Course[]>([]);
  // Agence de travail : celle fournie, sinon celle de la formation choisie.
  // Formation globale (sans agence) depuis un pays : première agence du pays.
  const { countries } = useOrgContext();
  const countryFirstAgencyId = countries.find((c) => c.id === countryId)?.agencies[0]?.id;
  const agencyId =
    pickedAgencyId ?? agencyProp ?? courses.find((c) => c.id === form.course_id)?.agency_id ?? (countryId ? countryFirstAgencyId : undefined);
  const currency = useAgencyCurrency(agencyId);
  const [enrollSessions, setEnrollSessions] = useState<TrainingSession[]>([]);
  // Preuve de paiement jointe à l'inscription (obligatoire pour un commercial,
  // comme pour une vente rapide).
  const [proofFile, setProofFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyForm);
      // Réinitialiser le choix pour que la prochaine ouverture reparte de
      // l'agence présélectionnée par la page (et non du choix précédent).
      setPickedAgencyId(agencyProp ?? '');
      setLearnerMode('existing');
      setNewLearner(emptyNewLearnerForm);
      setFormError(null);
      setFieldErrors({});
      setCourses([]);
      setEnrollSessions([]);
      setProofFile(null);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && presetCourseId) {
      setForm((prev) => ({ ...prev, course_id: presetCourseId }));
    }
  }, [isOpen, presetCourseId]);

  useEffect(() => {
    if (!isOpen) return;
    if (!pickedAgencyId) {
      setCourses([]);
      return;
    }
    let active = true;
    academyApi
      .courses({ agency_id: pickedAgencyId, per_page: 100 })
      .then((res) => {
        if (active) setCourses(res.data);
      })
      .catch(() => {
        if (active) setCourses([]);
      });
    return () => {
      active = false;
    };
    // Les formations se chargent sur le choix AU CHOIX de l'utilisateur, pas
    // sur l'agence de travail implicite : régénérer à chaque course.agency_id
    // écraserait la liste pendant la saisie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pickedAgencyId]);

  useEffect(() => {
    if (!form.course_id) {
      setEnrollSessions([]);
      return;
    }
    setEnrollSessions([]);
    let active = true;
    // Pas de filtre agency_id : une session hérite de l'agence de son cours
    // (potentiellement nulle pour les formations globales). Côté backend,
    // scopeQuery restreint déjà aux agences autorisées.
    academyApi
      .sessions({ course_id: form.course_id, per_page: 100 })
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
  }, [form.course_id]);

  const selectedCourse = useCallback(
    (courseId: string) => courses.find((c) => c.id === courseId) ?? null,
    [courses],
  );

  // Remise saisie et montant net réellement dû : affiché avant validation pour
  // que le vendeur voie l'effet de la remise sur le prix à payer.
  const basePrice = courseBasePrice(selectedCourse(form.course_id));
  const discountAmount = resolveEnrollmentDiscount(basePrice, form);
  const netPrice = Math.round((basePrice - discountAmount) * 100) / 100;

  // Une formation en ligne n'a pas forcément de session : la rendre obligatoire
  // empêcherait de l'inscrire. Le backend accepte une inscription sans session.
  const selectedIsOnline = isOnlineCourse(selectedCourse(form.course_id)?.mode);

  // Règle métier : tout client est un apprenant, mais tout apprenant n'est pas
  // un client. L'inscription exige un client (compte « client »), donc
  // l'autocomplete propose les clients enregistrés.
  const learnerOptions = useCallback(
    async (query: string) => {
      const q = query.trim();
      const results = await clientsApi.search(q);
      return results.map((client) => {
        const fullName =
          [client.first_name, client.last_name].filter(Boolean).join(' ') ||
          client.email ||
          '';
        return {
          id: client.id,
          label: fullName,
          subtitle: [client.client_number, client.email].filter(Boolean).join(' — '),
        };
      });
    },
    [],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!agencyId) return;
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      // Créer un nouvel apprenant (client) est possible SANS l'inscrire à une
      // formation : le choix du programme est optionnel. Un apprenant existant,
      // en revanche, doit avoir une formation pour être inscrit.
      const creatingLearner = learnerMode === 'new';
      const enrolling = Boolean(form.course_id);

      if (!enrolling && !creatingLearner) {
        setFormError(t('academy.courseOrNewLearner'));
        setIsSubmitting(false);
        return;
      }

      if (enrolling && netPrice > 0 && !(Number(form.amount_paid) > 0)) {
        setFormError(t('invoices.advanceRequired'));
        setFieldErrors({ amount_paid: t('invoices.advanceRequired') });
        setIsSubmitting(false);
        return;
      }

      // Un commercial ou un responsable d'agence doit joindre une preuve de paiement
      // uniquement quand une inscription (donc une facture) est créée.
      if (enrolling && needsPaymentProof && !proofFile) {
        setFormError(t('invoices.proofRequiredForSale'));
        setIsSubmitting(false);
        return;
      }

      let learnerUserId = form.learner_user_id;
      if (creatingLearner) {
        if (!newLearner.first_name || !newLearner.last_name) {
          setFormError(t('academy.newLearnerRequired'));
          setIsSubmitting(false);
          return;
        }
        const created = await clientsApi.create({
          first_name: newLearner.first_name,
          last_name: newLearner.last_name,
          email: newLearner.email.trim() || undefined,
          phone: newLearner.phone || null,
          city: newLearner.city || undefined,
          country: newLearner.country || undefined,
          nationality: newLearner.nationality || undefined,
          quartier: newLearner.quartier || undefined,
          occupation: newLearner.occupation || undefined,
          registered_agency_id: agencyId,
          commercial_user_id: currentUser?.id ?? undefined,
        });
        learnerUserId = created.id;
      }

      // Aucune formation choisie : on s'arrête à la création du client.
      if (!enrolling) {
        showToast(t('academy.clientCreatedNoEnrollment'), 'success');
        onSaved(null);
        onClose();
        return;
      }

      // Vendeur choisi dans la liste ; à défaut, le backend retient l'utilisateur connecté.
      const sellerUserId = sellerValue || undefined;

      // Le champ learner_user_id est OBLIGATOIRE côté backend. Si la valeur n'est
      // pas définie (ex. l'autocomplete n'a pas rempli le champs), on bloque la
      // soumission avec un message clair au lieu d'envoyer des données vides.
      if (!learnerUserId) {
        setFormError(t('academy.learnerRequired'));
        setIsSubmitting(false);
        return;
      }

      const payload: FormationEnrollmentPayload = {
        course_id: form.course_id,
        learner_user_id: learnerUserId,
        seller_user_id: sellerUserId,
        seller_trainer_id: form.seller_trainer_id || undefined,
        ...(form.training_session_id ? { training_session_id: form.training_session_id } : {}),
        ...(form.amount_paid ? { amount_paid: Number(form.amount_paid) } : {}),
        payment_type: form.payment_type || 'cash',
        notes: form.notes || undefined,
        ...(form.discount_type && form.discount_value
          ? { discount_type: form.discount_type, discount_value: Number(form.discount_value) }
          : {}),
      };

      const saved = proofFile
        ? await academyApi.createFormationEnrollmentWithProof(payload, proofFile, form.payment_type || 'cash')
        : await academyApi.createFormationEnrollment(payload);
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

        {/* L'agence se choisit (ou se change) EN PREMIER, à chaque ouverture :
            la liste de formations ci-dessous suit ce choix. */}
        <AgencyScopeSelect
          required
          allAgencies
          readOnly={isPreset}
          value={pickedAgencyId}
          onChange={(id) => {
            setPickedAgencyId(id);
            // La formation sélectionnée appartient à l'agence précédente :
            // on repart à zéro pour éviter de facturer la mauvaise entité.
            setForm((prev) => ({ ...prev, course_id: '', training_session_id: '' }));
          }}
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('nav.courses')}
          </label>
          {isPreset ? (
            <p className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
              {selectedCourse(form.course_id) ? courseOptionLabel(selectedCourse(form.course_id)!, t) : '…'}
            </p>
          ) : (
            <select
              value={form.course_id}
              onChange={(e) => setForm((prev) => ({ ...prev, course_id: e.target.value, training_session_id: '' }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="">{pickedAgencyId ? t('academy.searchCoursePlaceholder') : t('services.selectAgencyPlaceholder')}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {courseOptionLabel(course, t)}
                  {/* Depuis un pays, une même formation existe dans plusieurs agences. */}
                  {!agencyProp && course.agency?.name ? ` — ${course.agency.name}` : ''}
                </option>
              ))}
            </select>
          )}
          {fieldErrors.course_id && (
            <p className="mt-1 text-sm text-error-500">{fieldErrors.course_id}</p>
          )}
          {!form.course_id && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {t('academy.courseOptionalHint')}
            </p>
          )}
          {(basePrice > 0 || discountAmount > 0) && (
            <div className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              {discountAmount > 0 ? (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-normal opacity-80">
                    {t('invoices.discountLabel')} : −{discountAmount.toLocaleString()}
                  </span>
                  <span>{t('academy.priceToPay', { amount: netPrice.toLocaleString() })}</span>
                </div>
              ) : (
                <span>{t('academy.priceToPay', { amount: basePrice.toLocaleString() })}</span>
              )}
            </div>
          )}
        </div>

        {form.course_id && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {`${t('academy.session')}${selectedIsOnline ? '' : ' *'}`}
            </label>
            <select
              required={!selectedIsOnline}
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
                {selectedIsOnline ? t('academy.onlineNoSession') : t('academy.noSessionsForCourse')}
              </p>
            )}
            {selectedIsOnline && enrollSessions.length > 0 && (
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{t('academy.onlineSessionOptional')}</p>
            )}
            {fieldErrors.training_session_id && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.training_session_id}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('academy.discountType')}
            </label>
            <select
              value={form.discount_type}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  discount_type: e.target.value as '' | EnrollmentDiscountType,
                  discount_value: '',
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="">{t('academy.discountNone')}</option>
              <option value="percent">{t('academy.discountPercent')}</option>
              <option value="amount">{t('academy.discountAmount')}</option>
            </select>
          </div>
          <Input
            label={`${t('academy.discountValue')}${form.discount_type === 'percent' ? ' (%)' : ` (${currencyLabel(currency)})`}`}
            type="number"
            min={0}
            max={form.discount_type === 'percent' ? 100 : basePrice || undefined}
            step={form.discount_type === 'percent' ? 0.01 : 1}
            placeholder="0"
            value={form.discount_value}
            onChange={(e) => setForm((prev) => ({ ...prev, discount_value: e.target.value }))}
            disabled={!form.discount_type}
            hint={form.discount_type ? t('academy.discountHint') : undefined}
            error={fieldErrors.discount_value}
          />
        </div>

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

        {/* Vendeur : tous les utilisateurs (sauf super-admin). Un commercial,
            un caissier ou un responsable d'agence est présélectionné. */}
        <CommercialPicker
          label={t('academy.seller')}
          placeholder={t('academy.searchSellerPlaceholder')}
          value={sellerValue}
          selectedOption={sellerValue && sellerValue === currentUser?.id ? currentSellerOption : null}
          onChange={(id) => setForm((prev) => ({ ...prev, seller_user_id: id, seller_trainer_id: '' }))}
          error={fieldErrors.seller_user_id}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={`${t('academy.amountPaid')} (${currencyLabel(currency)})${form.course_id && netPrice > 0 ? ' *' : ''}`}
            type="number"
            min={0}
            placeholder="0"
            required={Boolean(form.course_id) && netPrice > 0}
            value={form.amount_paid}
            onChange={(e) => setForm((prev) => ({ ...prev, amount_paid: e.target.value }))}
            error={fieldErrors.amount_paid}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('invoices.headerPaymentType')}
            </label>
            <select
              value={form.payment_type}
              onChange={(e) => setForm((prev) => ({ ...prev, payment_type: e.target.value as '' | PaymentMethod }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              {needsPaymentProof && <option value="">—</option>}
              <option value="cash">{t('invoices.paymentCash')}</option>
              <option value="om">{t('invoices.paymentOm')}</option>
              <option value="momo">{t('invoices.paymentMomo')}</option>
              <option value="wave">{t('invoices.paymentWave')}</option>
            </select>
            {fieldErrors.payment_type && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.payment_type}</p>
            )}
          </div>
        </div>

        {needsPaymentProof && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('invoices.paymentProof')} <span className="text-error-500">*</span>
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 dark:text-gray-400"
            />
            {fieldErrors.proof_file && (
              <p className="mt-1 text-xs text-error-500">{fieldErrors.proof_file}</p>
            )}
            <p className="mt-1 text-xs text-gray-400">{t('invoices.paymentProofHint')}</p>
          </div>
        )}

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
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={needsPaymentProof && Boolean(form.course_id) && !proofFile}
            title={needsPaymentProof && Boolean(form.course_id) && !proofFile ? t('invoices.proofRequiredForSale') : undefined}
            className="flex-1"
          >
            {t('common.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
