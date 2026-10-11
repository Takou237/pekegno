import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  ShoppingCart,
  FileText,
  UserPlus,
  Package,
  BookOpen,
  Briefcase,
  Tags,
  CircleDollarSign,
  Settings2,
  Eye,
  EyeOff,
  Trash2,
  Link2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { clientsApi } from '@/api/clients.api';
import { extractErrorMessage } from '@/api/errors';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import QuickSaleModal from '@/components/invoices/QuickSaleModal';
import { ServiceFormModal } from '@/components/services/ServiceFormModal';
import { CourseFormModal } from '@/components/academy/CourseFormModal';
import { PackageFormModal } from '@/components/agencyDept/PackageFormModal';
import { OfferFormModal } from '@/components/agencyDept/OfferFormModal';

type ActionId =
  | 'sale'
  | 'invoice'
  | 'client'
  | 'service'
  | 'course'
  | 'package'
  | 'offer'
  | 'expense';

interface CustomLink {
  id: string;
  label: string;
  path: string;
}

interface Prefs {
  hidden: ActionId[];
  custom: CustomLink[];
}

const DEFAULT_ACTIONS: { id: ActionId; icon: typeof Plus; labelKey: string }[] = [
  { id: 'sale', icon: ShoppingCart, labelKey: 'quickCreate.newSale' },
  { id: 'invoice', icon: FileText, labelKey: 'quickCreate.newInvoice' },
  { id: 'client', icon: UserPlus, labelKey: 'quickCreate.newClient' },
  { id: 'service', icon: Tags, labelKey: 'quickCreate.newService' },
  { id: 'course', icon: BookOpen, labelKey: 'quickCreate.newCourse' },
  { id: 'package', icon: Package, labelKey: 'quickCreate.newPackage' },
  { id: 'offer', icon: Briefcase, labelKey: 'quickCreate.newOffer' },
  { id: 'expense', icon: CircleDollarSign, labelKey: 'quickCreate.newExpense' },
];

function prefsKey(userId: string) {
  return `pekegno.quickcreate.${userId}`;
}

function loadPrefs(userId: string): Prefs {
  try {
    const raw = localStorage.getItem(prefsKey(userId));
    if (!raw) return { hidden: [], custom: [] };
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
      custom: Array.isArray(parsed.custom) ? parsed.custom : [],
    };
  } catch {
    return { hidden: [], custom: [] };
  }
}

/**
 * Bouton « + » de création rapide, visible partout dans l'en-tête pour les
 * admins : vente, facture, client, service/produit, formation, package,
 * prestation, dépense. Chaque admin peut masquer des actions et ajouter ses
 * propres raccourcis (libellé + lien), stockés par utilisateur.
 */
export function QuickCreateMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [activeModal, setActiveModal] = useState<ActionId | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const role = user?.role?.name ?? '';
  const isAdmin = role === 'super-admin' || role === 'direction-generale';

  const [prefs, setPrefs] = useState<Prefs>({ hidden: [], custom: [] });
  const [customLabel, setCustomLabel] = useState('');
  const [customPath, setCustomPath] = useState('');

  // Nouveau client (formulaire inline).
  const [clientFirst, setClientFirst] = useState('');
  const [clientLast, setClientLast] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);
  const [clientSaving, setClientSaving] = useState(false);

  useEffect(() => {
    if (user?.id) setPrefs(loadPrefs(user.id));
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
        setManaging(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open ]);

  const visibleActions = useMemo(
    () => DEFAULT_ACTIONS.filter((a) => !prefs.hidden.includes(a.id)),
    [prefs.hidden],
  );

  if (!isAdmin || !user) return null;

  function persist(next: Prefs) {
    setPrefs(next);
    try {
      localStorage.setItem(prefsKey(user!.id), JSON.stringify(next));
    } catch {
      /* stockage indisponible : on garde l'état en mémoire */
    }
  }

  function toggleHidden(id: ActionId) {
    const hidden = prefs.hidden.includes(id)
      ? prefs.hidden.filter((h) => h !== id)
      : [...prefs.hidden, id];
    persist({ ...prefs, hidden });
  }

  function addCustom() {
    const label = customLabel.trim();
    let path = customPath.trim();
    if (!label || !path) return;
    if (!path.startsWith('/')) path = `/${path}`;
    const custom = [...prefs.custom, { id: `custom-${Date.now()}`, label, path }];
    persist({ ...prefs, custom });
    setCustomLabel('');
    setCustomPath('');
  }

  function removeCustom(id: string) {
    persist({ ...prefs, custom: prefs.custom.filter((c) => c.id !== id) });
  }

  function runAction(id: ActionId) {
    setOpen(false);
    setManaging(false);
    if (id === 'invoice') {
      navigate('/invoices/new');
      return;
    }
    if (id === 'expense') {
      navigate('/expenses');
      return;
    }
    setActiveModal(id);
  }

  async function handleCreateClient(e: FormEvent) {
    e.preventDefault();
    if (!clientFirst.trim() || !clientLast.trim()) {
      setClientError(t('academy.newLearnerRequired'));
      return;
    }
    setClientSaving(true);
    setClientError(null);
    try {
      await clientsApi.create({
        first_name: clientFirst.trim(),
        last_name: clientLast.trim(),
        email: clientEmail.trim() || `client-${Date.now()}@pekegno.local`,
        phone: clientPhone.trim() || null,
      });
      showToast(t('clients.created'), 'success');
      setActiveModal(null);
      setClientFirst('');
      setClientLast('');
      setClientEmail('');
      setClientPhone('');
    } catch (err) {
      setClientError(extractErrorMessage(err, t('clients.saveFailed')));
    } finally {
      setClientSaving(false);
    }
  }

  function closeModals() {
    setActiveModal(null);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg bg-brand-500 p-2 text-white shadow-sm transition-colors hover:bg-brand-600 dark:bg-brand-500 dark:hover:bg-brand-400"
        aria-label={t('quickCreate.title')}
        title={t('quickCreate.title')}
      >
        <Plus className="h-4.5 w-4.5" />
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-40 rounded-xl border border-gray-100 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {t('quickCreate.title')}
            </p>
            <button
              type="button"
              onClick={() => setManaging((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <Settings2 className="h-3.5 w-3.5" />
              {managing ? t('quickCreate.done') : t('quickCreate.manage')}
            </button>
          </div>

          <ul className="max-h-80 overflow-y-auto py-1">
            {visibleActions.map(({ id, icon: Icon, labelKey }) => (
              <li key={id} className="flex items-center gap-1 px-2">
                <button
                  type="button"
                  onClick={() => runAction(id)}
                  className="flex flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <Icon className="h-4 w-4 shrink-0 text-brand-500" />
                  {t(labelKey)}
                </button>
                {managing && (
                  <button
                    type="button"
                    onClick={() => toggleHidden(id)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                    title={t('quickCreate.hide')}
                  >
                    <EyeOff className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
            {prefs.custom.map((c) => (
              <li key={c.id} className="flex items-center gap-1 px-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate(c.path);
                  }}
                  className="flex flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <Link2 className="h-4 w-4 shrink-0 text-gray-400" />
                  {c.label}
                </button>
                {managing && (
                  <button
                    type="button"
                    onClick={() => removeCustom(c.id)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                    title={t('common.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
            {visibleActions.length === 0 && prefs.custom.length === 0 && (
              <li>
                <p className="px-4 py-6 text-center text-sm text-gray-400">
                  {t('quickCreate.allHidden')}
                </p>
              </li>
            )}
          </ul>

          {managing && (
            <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
              {prefs.hidden.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {DEFAULT_ACTIONS.filter((a) => prefs.hidden.includes(a.id)).map(({ id, labelKey }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleHidden(id)}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                    >
                      <Eye className="h-3 w-3" />
                      {t(labelKey)}
                    </button>
                  ))}
                </div>
              )}
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {t('quickCreate.addCustom')}
              </p>
              <div className="flex flex-col gap-2">
                <Input
                  placeholder={t('quickCreate.customLabel')}
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                />
                <div className="flex gap-2">
                  <Input
                    placeholder={t('quickCreate.customPath')}
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                  />
                  <Button type="button" onClick={addCustom} disabled={!customLabel.trim() || !customPath.trim()}>
                    {t('common.add')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <QuickSaleModal isOpen={activeModal === 'sale'} onClose={closeModals} />

      <Modal isOpen={activeModal === 'client'} onClose={closeModals} title={t('clients.createTitle')} maxWidth="max-w-md">
        <form onSubmit={handleCreateClient} className="flex flex-col gap-4">
          {clientError && <Alert variant="error">{clientError}</Alert>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={`${t('clients.firstName')} *`} required value={clientFirst} onChange={(e) => setClientFirst(e.target.value)} />
            <Input label={`${t('clients.lastName')} *`} required value={clientLast} onChange={(e) => setClientLast(e.target.value)} />
          </div>
          <Input label={t('clients.email')} type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
          <Input label={t('clients.phone')} type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeModals}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={clientSaving}>
              {t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>

      <ServiceFormModal
        isOpen={activeModal === 'service'}
        service={null}
        onClose={closeModals}
        onSaved={closeModals}
      />

      <CourseFormModal
        isOpen={activeModal === 'course'}
        course={null}
        onClose={closeModals}
        onSaved={closeModals}
      />

      <PackageFormModal
        isOpen={activeModal === 'package'}
        onClose={closeModals}
        onSaved={closeModals}
      />

      <OfferFormModal
        isOpen={activeModal === 'offer'}
        onClose={closeModals}
        onSaved={closeModals}
      />
    </div>
  );
}
