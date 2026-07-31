import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { servicesApi, promotionsApi, categoriesApi } from '@/api/services.api';
import { agenciesApi } from '@/api/agencies.api';
import { departmentsApi } from '@/api/departments.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { Agency } from '@/types/agency';
import type { Department } from '@/types/department';
import type { Category } from '@/types/category';
import type { Service, ServicePayload } from '@/types/service';

interface PromotionDraft {
  id?: string;
  promotional_price: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface ServiceFormValues {
  name: string;
  category_id: string;
  price: string;
  coverage: string;
  description: string;
  presentation_video: string;
  agency_id: string;
  department_id: string;
  reason: string;
}

interface ServiceFormModalProps {
  isOpen: boolean;
  service: Service | null;
  onClose: () => void;
  onSaved: (service: Service) => void;
}

function toLocalInputValue(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoString(local: string): string {
  if (!local) return '';
  return new Date(local).toISOString();
}

function emptyForm(): ServiceFormValues {
  return {
    name: '',
    category_id: '',
    price: '',
    coverage: '',
    description: '',
    presentation_video: '',
    agency_id: '',
    department_id: '',
    reason: '',
  };
}

export function ServiceFormModal({ isOpen, service, onClose, onSaved }: ServiceFormModalProps) {
  const { showToast } = useToast();
  const isEditing = service !== null;

  const [form, setForm] = useState<ServiceFormValues>(emptyForm());
  const [drafts, setDrafts] = useState<PromotionDraft[]>([]);
  const [originalPrice, setOriginalPrice] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;

    setFormError(null);
    setFieldErrors({});

    if (!service) {
      setForm(emptyForm());
      setOriginalPrice('');
      setDrafts([]);
      return;
    }

    servicesApi
      .get(service.id)
      .then((full) => {
        setForm({
          name: full.name,
          category_id: full.category_id,
          price: full.price,
          coverage: full.coverage ?? '',
          description: full.description ?? '',
          presentation_video: full.presentation_video ?? '',
          agency_id: full.agency_id ?? '',
          department_id: full.department_id ?? '',
          reason: '',
        });
        setOriginalPrice(full.price);
        setDrafts(
          (full.promotions ?? []).map((p) => ({
            id: p.id,
            promotional_price: p.promotional_price,
            start_date: toLocalInputValue(p.start_date),
            end_date: toLocalInputValue(p.end_date),
            is_active: p.is_active,
          }))
        );
      })
      .catch(() => {
        setForm({
          name: service.name,
          category_id: service.category_id,
          price: service.price,
          coverage: service.coverage ?? '',
          description: service.description ?? '',
          presentation_video: service.presentation_video ?? '',
          agency_id: service.agency_id ?? '',
          department_id: service.department_id ?? '',
          reason: '',
        });
        setOriginalPrice(service.price);
        setDrafts([]);
      });
  }, [isOpen, service]);

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([
      categoriesApi.list(),
      agenciesApi.list({ per_page: 100 }),
      departmentsApi.list({ per_page: 100 }),
    ])
      .then(([categoriesRes, agenciesRes, departmentsRes]) => {
        setCategories(categoriesRes);
        setAgencies(agenciesRes.data);
        setDepartments(departmentsRes.data);
      })
      .catch(() => {});
  }, [isOpen]);

  function update<K extends keyof ServiceFormValues>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateDraft(index: number, patch: Partial<PromotionDraft>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function addDraft() {
    setDrafts((prev) => [
      ...prev,
      { promotional_price: '', start_date: '', end_date: '', is_active: true },
    ]);
  }

  function removeDraft(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const priceChanged = isEditing && String(form.price) !== String(originalPrice);
      const payload: ServicePayload = {
        ...form,
        agency_id: form.agency_id || null,
        department_id: form.department_id || null,
      };
      if (priceChanged) {
        payload.reason = form.reason?.trim() || 'Mise à jour du prix';
      }

      const saved = isEditing
        ? await servicesApi.update(service.id, payload)
        : await servicesApi.create(payload);

      const existingIds = new Set(saved.promotions?.map((p) => p.id) ?? []);
      for (const draft of drafts) {
        if (draft.id) {
          existingIds.delete(draft.id);
          await promotionsApi.update(draft.id, {
            promotional_price: draft.promotional_price,
            start_date: toIsoString(draft.start_date),
            end_date: toIsoString(draft.end_date),
            is_active: draft.is_active,
          });
        } else {
          await promotionsApi.create(saved.id, {
            promotional_price: draft.promotional_price,
            start_date: toIsoString(draft.start_date),
            end_date: toIsoString(draft.end_date),
            is_active: draft.is_active,
          });
        }
      }
      for (const id of existingIds) {
        await promotionsApi.remove(id);
      }

      showToast(isEditing ? 'Service modifié avec succès.' : 'Service créé avec succès.', 'success');
      onSaved(await servicesApi.get(saved.id));
      onClose();
    } catch (error) {
      setFormError(extractErrorMessage(error, "Impossible d'enregistrer le service."));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const availableDepartments = form.agency_id
    ? departments.filter((d) => d.agency_id === form.agency_id)
    : departments;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Modifier le service' : 'Nouveau service'}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Nom du service"
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            error={fieldErrors.name}
            placeholder="Formation Marketing Digital"
          />
          <Select
            label="Catégorie"
            required
            value={form.category_id}
            onChange={(e) => update('category_id', e.target.value)}
            error={fieldErrors.category_id}
          >
            <option value="">Sélectionner une catégorie...</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Prix (FCFA)"
            required
            type="number"
            min={0}
            step="0.01"
            value={form.price}
            onChange={(e) => update('price', e.target.value)}
            error={fieldErrors.price}
            placeholder="250000"
          />
          <Input
            label="Couverture"
            value={form.coverage}
            onChange={(e) => update('coverage', e.target.value)}
            error={fieldErrors.coverage}
            placeholder="Nationale, Régionale, Locale..."
          />
          <Input
            label="Vidéo de présentation (URL)"
            value={form.presentation_video}
            onChange={(e) => update('presentation_video', e.target.value)}
            error={fieldErrors.presentation_video}
            placeholder="https://..."
          />
        </div>

        <Input
          label="Description"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          error={fieldErrors.description}
          placeholder="Décrivez le service, ses objectifs et son contenu..."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Agence"
            value={form.agency_id}
            onChange={(e) => {
              update('agency_id', e.target.value);
              setForm((prev) => ({ ...prev, department_id: '' }));
            }}
            error={fieldErrors.agency_id}
          >
            <option value="">Aucune agence</option>
            {agencies.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.name}
              </option>
            ))}
          </Select>
          <Select
            label="Département"
            value={form.department_id}
            onChange={(e) => update('department_id', e.target.value)}
            error={fieldErrors.department_id}
          >
            <option value="">Aucun département</option>
            {availableDepartments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </div>

        {isEditing && String(form.price) !== String(originalPrice) && (
          <Input
            label="Motif du changement de prix"
            value={form.reason ?? ''}
            onChange={(e) => update('reason', e.target.value)}
            hint="Conservé dans l'historique des prix."
          />
        )}

        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/40">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Promotions temporaires
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Prix réduit appliqué automatiquement entre les dates indiquées.
              </p>
            </div>
            <div className="w-36">
              <Button type="button" variant="outline" size="sm" onClick={addDraft}>
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </div>
          </div>

          {drafts.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune promotion définie.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {drafts.map((draft, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Input
                      label="Prix promotionnel"
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.promotional_price}
                      onChange={(e) => updateDraft(index, { promotional_price: e.target.value })}
                      placeholder="200000"
                    />
                    <Input
                      label="Début"
                      type="datetime-local"
                      value={draft.start_date}
                      onChange={(e) => updateDraft(index, { start_date: e.target.value })}
                    />
                    <Input
                      label="Fin"
                      type="datetime-local"
                      value={draft.end_date}
                      onChange={(e) => updateDraft(index, { end_date: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={draft.is_active}
                        onChange={(e) => updateDraft(index, { is_active: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                      />
                      Promotion active
                    </label>
                    <button
                      type="button"
                      onClick={() => removeDraft(index)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                      title="Supprimer la promotion"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <div className="w-32">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Annuler
            </Button>
          </div>
          <div className="w-40">
            <Button type="submit" isLoading={isSubmitting}>
              {isEditing ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
