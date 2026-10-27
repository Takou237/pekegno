import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoicesApi } from '@/api/invoices.api';
import { clientsApi } from '@/api/clients.api';
import { commercialsApi } from '@/api/commercials.api';
import { employeesApi } from '@/api/employees.api';
import { usersApi } from '@/api/users.api';
import { agenciesApi } from '@/api/agencies.api';
import { scopeApi, type AgencyOption } from '@/api/scope.api';
import { servicesApi } from '@/api/services.api';
import { academyApi } from '@/api/academy.api';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { productsApi, type ProductSearchItem } from '@/api/products.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/utils/number';
import { invoiceBackPath, invoiceListPath, withInvoiceFilters } from '@/utils/invoiceNavigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Autocomplete, FREE_TEXT_PREFIX, type AutocompleteOption } from '@/components/ui/Autocomplete';
import { Alert } from '@/components/ui/Alert';
import type { PaymentMethod } from '@/types/invoice';
import type { ServiceSearchItem } from '@/types/service';
import type { Commercial } from '@/types/commercial';
import { todayLocal } from '@/utils/date';
import { useAgencyCurrency } from '@/hooks/useAgencyCurrency';

/** Type de ligne : il filtre la recherche du catalogue (champ à côté). */
type LineKind = 'product' | 'course' | 'package' | 'service';

interface CatalogOption {
  id: string;
  name: string;
  price: number;
}

interface InvoiceLineDraft {
  key: string;
  kind: LineKind;
  service_id: string;
  product_id: string;
  course_id: string;
  package_id: string;
  label: string;
  unit_price: string;
  quantity: string;
  pass_tier: string;
}

let lineCounter = 0;
function newLine(): InvoiceLineDraft {
  lineCounter += 1;
  return { key: `line-${lineCounter}`, kind: 'product', service_id: '', product_id: '', course_id: '', package_id: '', label: '', unit_price: '', quantity: '1', pass_tier: '' };
}

export default function InvoiceFormPage({
  lockedAgencyId,
  backPath,
  successPath,
}: { lockedAgencyId?: string; backPath?: string; successPath?: string } = {}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { agencyId: routeAgencyId } = useParams<{ agencyId?: string }>();
  const [searchParams] = useSearchParams();

  const isCommercial = currentUser?.role?.name === 'commercial';
  const isResponsableAgence = currentUser?.role?.name === 'responsable-agence';
  const isCaissier = currentUser?.role?.name === 'caissier';
  const isSuperAdmin = currentUser?.role?.name === 'super-admin';
    // Le caissier et le super-admin valident directement leurs ventes de guichet.
    // La direction garde son vendeur par dǸfaut mais ses ventes restent en attente.
    const isSelfSellerRole = ['caissier', 'super-admin', 'direction-generale'].includes(
      currentUser?.role?.name ?? ''
    );
  const needsPaymentProof = isCommercial || isResponsableAgence;

  const presetAgencyId = lockedAgencyId ?? routeAgencyId ?? searchParams.get('agency_id') ?? '';
  const [agencyLocked] = useState(Boolean(presetAgencyId));
  const [lockedAgencyName, setLockedAgencyName] = useState('');

  // Liste de retour : le chemin explicite s'il est fourni (en-tête academy…),
  // sinon le niveau courant — `/countries/:id/invoices/new` ramène vers la liste
  // du pays, pas vers la liste globale.
  const listPath = backPath ?? (location.pathname.replace(/\/new\/?$/, '') || invoiceListPath(presetAgencyId));
  const cancelPath = invoiceBackPath(location.state, listPath);

  const [clientId, setClientId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [sellerIsTrainer, setSellerIsTrainer] = useState(false);
  const [agencyId, setAgencyId] = useState(presetAgencyId);
  const currency = useAgencyCurrency(agencyId);
  const [invoiceDate, setInvoiceDate] = useState(todayLocal());
  const [paymentType, setPaymentType] = useState<'' | PaymentMethod>('');
  const [payerPhone, setPayerPhone] = useState('');
  const [advance, setAdvance] = useState('');
  const [discount, setDiscount] = useState('');
  const [vatRate, setVatRate] = useState('');
  const [comment, setComment] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [lines, setLines] = useState<InvoiceLineDraft[]>([newLine()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [myCommercial, setMyCommercial] = useState<Commercial | null>(null);
  const serviceResultsRef = useRef<Record<string, ServiceSearchItem[]>>({});
  const productResultsRef = useRef<Record<string, ProductSearchItem[]>>({});
  const offerResultsRef = useRef<Record<string, CatalogOption[]>>({});

  // Vente inter-agences : le sélecteur d'agence doit proposer TOUTES les agences
  // (un chef de Douala peut facturer un produit de Yaoundé). Les listes de gestion
  // restent scopées, seul ce sélecteur de vente est ouvert.
  const [saleAgencies, setSaleAgencies] = useState<AgencyOption[] | null>(null);

  useEffect(() => {
    if (agencyLocked || isCommercial || isResponsableAgence) return;
    let active = true;
    scopeApi
      .agencies()
      .then((rows) => {
        if (active) setSaleAgencies(rows);
      })
      .catch(() => {
        if (active) setSaleAgencies([]);
      });
    return () => {
      active = false;
    };
  }, [agencyLocked, isCommercial, isResponsableAgence]);

  const selectedAgencyOption = useMemo(() => {
    const found = saleAgencies?.find((a) => a.id === agencyId);
    if (!found) return null;
    return {
      id: found.id,
      label: found.name,
      subtitle: [found.code, found.country_name].filter(Boolean).join(' — '),
    };
  }, [saleAgencies, agencyId]);

  // Un règlement mobile money sans numéro payeur est inexploitable (traçabilité
  // de la transaction) : le champ apparaît et devient obligatoire pour OM / MoMo.
  const requiresPayerPhone = paymentType === 'om' || paymentType === 'momo';

  useEffect(() => {
    if ((!isCommercial && !isResponsableAgence) || !currentUser?.id) return;
    commercialsApi
      .list({ per_page: 100 })
      .then((res) => {
        const mine = (res.data ?? []).find((c) => c.user_id === currentUser.id) ?? null;
        setMyCommercial(mine);
        if (mine) {
          setSellerId(mine.id);
          setSellerIsTrainer(false);
          if (mine.agency_id && !presetAgencyId) setAgencyId(mine.agency_id);
        }
      })
      .catch(() => {});
    if (isResponsableAgence && !myCommercial) {
      commercialsApi
        .myStats()
        .catch(() => null)
        .then((stats: any) => {
          const agencyFromStats =
            stats?.commercial?.agency_id ||
            stats?.agency_id ||
            stats?.commercial?.agency?.id ||
            stats?.profile?.agency_id;
          if (agencyFromStats && !presetAgencyId && !agencyId) {
            setAgencyId(agencyFromStats);
          }
        });
    }
  }, [isCommercial, isResponsableAgence, currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    if (currentUser.role?.name === 'caissier') {
      // Le caissier a un profil employé (Commercial kind=employe) : on le rattache
      // via commercial_id, comme un commercial, pour que ses ventes remontent dans
      // ses stats (CA, nombre de ventes, points) et pas seulement via seller_user_id.
      employeesApi
        .list({ per_page: 100, include_trainers: true })
        .then((res) => {
          const mine = (res.data ?? []).find((c) => c.user_id === currentUser.id) ?? null;
          if (mine) {
            setMyCommercial(mine);
            setSellerId(mine.id);
            setSellerIsTrainer(false);
          } else {
            setSellerId(currentUser.id);
            setSellerIsTrainer(true);
          }
        })
        .catch(() => {
          setSellerId(currentUser.id);
          setSellerIsTrainer(true);
        });
    } else if (isSelfSellerRole) {
      setSellerId(currentUser.id);
      setSellerIsTrainer(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelfSellerRole, currentUser?.id]);

  useEffect(() => {
    if (!agencyLocked || !presetAgencyId) return;
    let active = true;
    agenciesApi
      .get(presetAgencyId)
      .then((a) => {
        if (active) setLockedAgencyName(a.name);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [agencyLocked, presetAgencyId]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce(
      (sum, line) => sum + (Number(line.unit_price) || 0) * (Number(line.quantity) || 0),
      0
    );
    const discountValue = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
    const afterDiscount = subtotal - discountValue;
    const vatValue = (Number(vatRate) || 0) / 100;
    const total = afterDiscount * (1 + vatValue);
    const advanceValue = Number(advance) || 0;
    return {
      subtotal,
      discount: discountValue,
      vat: total - afterDiscount,
      total: Math.round(total * 100) / 100,
      advance: advanceValue,
      balance: Math.max(0, Math.round(total * 100) / 100 - advanceValue),
    };
  }, [lines, advance, discount, vatRate]);

  function updateLine(key: string, patch: Partial<InvoiceLineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  function handleServiceSelect(key: string, serviceId: string) {
    const results = serviceResultsRef.current[key] ?? [];
    const service = results.find((s) => s.id === serviceId);
    if (!service) return;
    const alreadyUsed = lines.some((l) => l.key !== key && l.service_id === serviceId);
    if (alreadyUsed) {
      showToast(t('invoices.duplicateService'), 'error');
      return;
    }
    const patches: Partial<InvoiceLineDraft> = {
      kind: 'service',
      service_id: service.id,
      product_id: '',
      course_id: '',
      package_id: '',
      label: service.name,
      unit_price: String(service.effective_price ?? service.price ?? ''),
    };
    if (service.is_seminar && service.seminar_tiers && service.seminar_tiers.length > 0) {
      patches.pass_tier = service.seminar_tiers[0].tier;
      patches.unit_price = String(service.seminar_tiers[0].price);
    } else {
      patches.pass_tier = '';
    }
    updateLine(key, patches);
  }

  function handleProductSelect(key: string, productId: string) {
    const results = productResultsRef.current[key] ?? [];
    const product = results.find((p) => p.id === productId);
    if (!product) return;
    const alreadyUsed = lines.some((l) => l.key !== key && l.product_id === productId);
    if (alreadyUsed) {
      showToast(t('invoices.duplicateService'), 'error');
      return;
    }

    // Si le produit appartient à une agence différente, on bascule la facture
    // sur cette agence pour garantir la cohérence (stock, CA, etc.).
    if (product.agency_id && product.agency_id !== agencyId && !agencyLocked) {
      setAgencyId(product.agency_id);
    }

    updateLine(key, {
      kind: 'product',
      product_id: product.id,
      service_id: '',
      course_id: '',
      package_id: '',
      label: product.name,
      unit_price: String(product.selling_price ?? product.price_with_tax ?? ''),
      pass_tier: '',
    });
  }

  /** Formation ou package choisi : prix effectif (promotion comprise). */
  function handleOfferSelect(key: string, kind: 'course' | 'package', id: string) {
    const offer = (offerResultsRef.current[key] ?? []).find((o) => o.id === id);
    if (!offer) return;
    const field = kind === 'course' ? 'course_id' : 'package_id';
    if (lines.some((l) => l.key !== key && l[field] === id)) {
      showToast(t('invoices.duplicateService'), 'error');
      return;
    }
    updateLine(key, {
      kind,
      service_id: '',
      product_id: '',
      course_id: kind === 'course' ? offer.id : '',
      package_id: kind === 'package' ? offer.id : '',
      label: offer.name,
      unit_price: String(offer.price),
      pass_tier: '',
    });
  }

  /** Recherche du catalogue selon le type de la ligne. */
  async function searchCatalog(key: string, kind: LineKind, query: string): Promise<AutocompleteOption[]> {
    const q = query.trim();
    if (kind === 'service') {
      const res = await servicesApi.search(q);
      serviceResultsRef.current[key] = res;
      return res.map((s) => ({
        id: s.id,
        label: s.name,
        subtitle: `${formatCurrency(Number(s.effective_price ?? s.price), currency)}${s.has_promotion ? ' · promo' : ''}${s.category ? ` · ${s.category}` : ''}`,
      }));
    }
    if (kind === 'product') {
      // Recherche ouverte à tous les produits (for_sale) : le vendeur peut
      // facturer un article d'une autre agence ; la facture bascule alors sur
      // l'agence du produit sélectionné.
      const res = await productsApi.search(q);
      productResultsRef.current[key] = res;
      return res.map((p) => ({
        id: p.id,
        label: p.name,
        subtitle: `${formatCurrency(Number(p.selling_price), currency)}${p.category ? ` · ${p.category}` : ''}`,
      }));
    }
    const offers: CatalogOption[] = kind === 'course'
      ? (await academyApi.courses({ search: q || undefined, agency_id: agencyId || undefined, per_page: 20 })).data.map((c) => ({
          id: c.id,
          name: c.name,
          price: Number(c.effective_price ?? c.price ?? 0),
        }))
      : (await agencyDeptApi.packages({ search: q || undefined, agency_id: agencyId || undefined, per_page: 20 })).map((pk) => ({
          id: pk.id,
          name: pk.name,
          price: Number(pk.effective_price ?? pk.price_per_month ?? 0),
        }));
    offerResultsRef.current[key] = offers;
    return offers.map((o) => ({ id: o.id, label: o.name, subtitle: formatCurrency(o.price, currency) }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validLines = lines.filter(
      (l) => l.label.trim() || l.service_id || l.product_id || l.course_id || l.package_id || Number(l.unit_price) > 0
    );
    if (validLines.length === 0) {
      setErrors({ items: t('invoices.noItems') });
      return;
    }
    if (!clientId) {
      setErrors({ client_id: t('invoices.colClient') });
      return;
    }
    if (requiresPayerPhone && !payerPhone.trim()) {
      setErrors({ payer_phone: t('invoices.payerPhoneRequired') });
      return;
    }
    if (Number(advance) > totals.total) {
      setErrors({ advance: t('invoices.advanceExceedsTotal') });
      return;
    }
    if (totals.total > 0 && !(Number(advance) > 0)) {
      setErrors({ advance: t('invoices.advanceRequired') });
      return;
    }
      if (needsPaymentProof && !proofFile) {
        setErrors({ proof_file: t('invoices.proofRequiredForSale') });
        return;
      }
    const freeClientName = clientId.startsWith(FREE_TEXT_PREFIX) ? clientId.slice(FREE_TEXT_PREFIX.length) : '';
    setSubmitting(true);
    setErrors({});
    try {
      const payload = {
        client_id: freeClientName ? undefined : clientId || undefined,
        client_name: freeClientName || undefined,
        commercial_id: !sellerIsTrainer && sellerId ? sellerId : undefined,
        seller_user_id: sellerIsTrainer && sellerId ? sellerId : undefined,
        agency_id: agencyId || undefined,
        invoice_date: invoiceDate,
        payment_type: paymentType || undefined,
        payer_phone: requiresPayerPhone ? payerPhone.trim() : undefined,
        comment: comment || undefined,
        // L'avance est envoyée aussi par un commercial : elle est enregistrée côté
        // backend comme avance déclarée (declared_advance), appliquée à la validation
        // par le caissier (le commercial ne peut pas manier la caisse).
        advance: Number(advance) || undefined,
        discount: Number(discount) || undefined,
        vat_rate: Number(vatRate) || undefined,
        items: validLines.map((l) => ({
          service_id: l.kind === 'service' ? l.service_id || undefined : undefined,
          product_id: l.kind === 'product' ? l.product_id || undefined : undefined,
          course_id: l.kind === 'course' ? l.course_id || undefined : undefined,
          package_id: l.kind === 'package' ? l.package_id || undefined : undefined,
          label: l.label.trim() || undefined,
          unit_price: Number(l.unit_price) || 0,
          quantity: Number(l.quantity) || 1,
          pass_tier: l.kind === 'service' ? l.pass_tier || undefined : undefined,
        })),
      };
      if (proofFile) {
        await invoicesApi.createWithProof(payload, proofFile);
      } else {
        await invoicesApi.create(payload);
      }
      showToast(t('invoices.created'), 'success');
      // Retour sur la liste d'origine, filtres conservés : on reste là où l'on
      // était plutôt que sur une liste vierge.
      navigate(successPath ?? withInvoiceFilters(listPath, searchParams));
    } catch (error) {
      setErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('invoices.saveFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to={cancelPath}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('invoices.backToList')}
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('invoices.createTitle')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        {Object.keys(errors).length > 0 && (
          <Alert variant="error">{Object.values(errors).join(' ')}</Alert>
        )}

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Autocomplete
              label={t('invoices.headerClient')}
              placeholder={t('invoices.headerClientPlaceholder')}
              value={clientId}
              onChange={setClientId}
              fetchOptions={async (query) => {
                const res = await clientsApi.search(query.trim());
                return res.map((c) => ({
                  id: c.id,
                  label: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || '',
                  subtitle: [c.email, c.client_number].filter(Boolean).join(' — '),
                }));
              }}
              error={errors.client_id}
            />
            {isCommercial || isResponsableAgence || isSelfSellerRole ? (
              <Input
                label={t('invoices.seller')}
                value={
                  myCommercial
                    ? myCommercial.full_name || [myCommercial.first_name, myCommercial.last_name].filter(Boolean).join(' ')
                    : currentUser?.name?.trim() ||
                      [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') ||
                      currentUser?.email ||
                      ''
                }
                disabled
              />
            ) : (
              <Autocomplete
                label={t('invoices.seller')}
                placeholder={t('invoices.headerCommercialPlaceholder')}
                value={sellerId}
                onChange={(id) => {
                  if (!id) {
                    setSellerId('');
                    setSellerIsTrainer(false);
                  }
                }}
                onPick={(option) => {
                  if (option.isTrainer) {
                    setSellerIsTrainer(true);
                    setSellerId(option.userId ?? option.id);
                  } else {
                    setSellerIsTrainer(false);
                    setSellerId(option.id);
                  }
                }}
                fetchOptions={async (query) => {
                  // Liste de tous les comptes du staff (clients exclus) : un
                  // vendeur est attribuable même s'il n'a pas encore de fiche.
                  const [usersRes, comsRes] = await Promise.all([
                    usersApi.list({ search: query.trim() || undefined, per_page: 100 }).catch(() => ({ data: [] })),
                    commercialsApi.list({ include_trainers: true, per_page: 100 }).catch(() => ({ data: [] })),
                  ]);
                  // Fiches formateurs : la vente est attributable via le compte
                  // utilisateur (seller_user_id), comme avant.
                  const trainerProfileByUserId = new Map<string, string>();
                  for (const c of comsRes.data) {
                    if (c.is_trainer && c.user_id) trainerProfileByUserId.set(c.user_id, c.id);
                  }
                  return usersRes.data
                    .filter((u) => u.role?.name !== 'client')
                    .map((u) => {
                      const trainerProfileId = trainerProfileByUserId.get(u.id);
                      return trainerProfileId
                        ? {
                            id: trainerProfileId,
                            userId: u.id,
                            isTrainer: true,
                            label: u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || u.email,
                            subtitle: u.email,
                          }
                        : {
                            id: u.id,
                            label: u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || u.email,
                            subtitle: u.role?.name ?? u.email,
                          };
                    });
                }}
              />
            )}
            {agencyLocked ? (
              <Input
                label={t('invoices.headerAgency')}
                value={lockedAgencyName}
                disabled
              />
            ) : (isCommercial || isResponsableAgence) ? (
                <Input
                  label={t('invoices.headerAgency')}
                  value={myCommercial?.agency?.name ?? ''}
                  disabled
                />
              ) : (
              <Autocomplete
                label={t('invoices.headerAgency')}
                placeholder={t('commercials.agencyPlaceholder')}
                value={agencyId}
                onChange={setAgencyId}
                selectedOption={selectedAgencyOption}
                fetchOptions={async (query) => {
                  // Liste non scopée : la vente peut viser une agence d'une autre
                  // ville/pays que celle du vendeur.
                  const rows = saleAgencies ?? (await scopeApi.agencies());
                  const q = query.trim().toLowerCase();
                  return rows
                    .filter(
                      (a) =>
                        !q ||
                        a.name.toLowerCase().includes(q) ||
                        (a.code ?? '').toLowerCase().includes(q) ||
                        (a.country_name ?? '').toLowerCase().includes(q)
                    )
                    .map((a) => ({
                      id: a.id,
                      label: a.name,
                      subtitle: [a.code, a.country_name].filter(Boolean).join(' — '),
                    }));
                }}
                error={errors.agency_id}
              />
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={t('invoices.headerDate')}
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                error={errors.invoice_date}
              />
              <Select
                label={t('invoices.headerPaymentType')}
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as '' | PaymentMethod)}
              >
                <option value="">—</option>
                <option value="cash">{t('invoices.paymentCash')}</option>
                <option value="om">{t('invoices.paymentOm')}</option>
                <option value="momo">{t('invoices.paymentMomo')}</option>
              </Select>
              {requiresPayerPhone && (
                <Input
                  label={`${t('invoices.payerPhone')} *`}
                  value={payerPhone}
                  onChange={(e) => setPayerPhone(e.target.value)}
                  error={errors.payer_phone}
                  hint={t('invoices.payerPhoneHint')}
                  placeholder="+237 6XX XXX XXX"
                />
              )}
            </div>
            {needsPaymentProof && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('invoices.paymentProof')}
                    <span className="text-error-500"> *</span>
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 dark:text-gray-400"
                  />
                  {errors.proof_file && <p className="mt-1 text-xs text-error-500">{errors.proof_file}</p>}
                  <p className="mt-1 text-xs text-gray-400">{t('invoices.paymentProofHint')}</p>
                </div>
              )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('invoices.items')}
          </h2>
          <div className="flex flex-col gap-4">
            {lines.map((line, index) => {
              const results = serviceResultsRef.current[line.key] ?? [];
              const selectedService = results.find((s) => s.id === line.service_id);
              const tiers = selectedService?.seminar_tiers;
              const hasTiers = line.kind === 'service' && line.pass_tier !== '' && tiers && tiers.length > 0;
              return (
              <div key={line.key} className="flex flex-col gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="w-full sm:w-40">
                  <Select
                    label={index === 0 ? t('invoices.itemKind') : undefined}
                    value={line.kind}
                    onChange={(e) => {
                      // Changer de type vide la sélection : la recherche ne porte
                      // plus sur le même catalogue.
                      updateLine(line.key, {
                        kind: e.target.value as LineKind,
                        service_id: '',
                        product_id: '',
                        course_id: '',
                        package_id: '',
                        label: '',
                        unit_price: '',
                        pass_tier: '',
                      });
                    }}
                  >
                    <option value="product">{t('invoices.kindProducts')}</option>
                    <option value="course">{t('invoices.kindCourses')}</option>
                    <option value="package">{t('invoices.kindPackages')}</option>
                    <option value="service">{t('invoices.kindPrestations')}</option>
                  </Select>
                </div>
                <div className="min-w-0 flex-1">
                  <Autocomplete
                    key={`${line.key}-${line.kind}`}
                    label={index === 0 ? t(`invoices.kindSearch_${line.kind}`) : undefined}
                    placeholder={t(`invoices.kindSearchPlaceholder_${line.kind}`)}
                    value={
                      line.kind === 'service' ? line.service_id
                        : line.kind === 'product' ? line.product_id
                        : line.kind === 'course' ? line.course_id
                        : line.package_id
                    }
                    onChange={(id) => {
                      if (!id) return;
                      if (line.kind === 'service') handleServiceSelect(line.key, id);
                      else if (line.kind === 'product') handleProductSelect(line.key, id);
                      else handleOfferSelect(line.key, line.kind, id);
                    }}
                    fetchOptions={(query) => searchCatalog(line.key, line.kind, query)}
                  />
                </div>
                {hasTiers && (
                  <div className="w-full sm:w-40">
                    <Select
                      label={index === 0 ? t('invoices.passTier') : undefined}
                      value={line.pass_tier}
                      onChange={(e) => {
                        const tier = tiers.find((t) => t.tier === e.target.value);
                        updateLine(line.key, {
                          pass_tier: e.target.value,
                          unit_price: tier ? String(tier.price) : line.unit_price,
                        });
                      }}
                    >
                      {tiers.map((t) => (
                        <option key={t.tier} value={t.tier}>{t.label} — {formatCurrency(Number(t.price), currency)}</option>
                      ))}
                    </Select>
                  </div>
                )}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="w-full sm:w-52">
                  <Input
                    label={index === 0 ? t('invoices.itemLabel') : ''}
                    value={line.label}
                    onChange={(e) => updateLine(line.key, { label: e.target.value })}
                    error={errors[`items.${index}.label`]}
                  />
                </div>
                <div className="w-full sm:w-24">
                  <Input
                    label={index === 0 ? t('invoices.itemQuantity') : ''}
                    type="number"
                    min={1}
                    step="1"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    error={errors[`items.${index}.quantity`]}
                  />
                </div>
                <div className="w-full sm:w-36">
                  <Input
                    label={index === 0 ? t('invoices.itemUnitPrice') : ''}
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unit_price}
                    onChange={(e) => updateLine(line.key, { unit_price: e.target.value })}
                    error={errors[`items.${index}.unit_price`]}
                  />
                </div>
                <div className="ml-auto flex items-center gap-3 sm:flex-col sm:items-end">
                  <span className="hidden text-sm font-semibold text-gray-800 dark:text-gray-100 sm:block">
                    {formatCurrency(
                      (Number(line.unit_price) || 0) * (Number(line.quantity) || 0)
                    , currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                    title={t('invoices.removeLine')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                </div>
              </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setLines((prev) => [...prev, newLine()])}
            className="mt-4"
          >
            <Plus className="h-4 w-4" />
            {t('invoices.addLine')}
          </Button>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('invoices.discount')}
              type="number"
              min={0}
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              error={errors.discount}
              hint={t('invoices.discountHint')}
            />
            <Input
              label={t('invoices.vatRate')}
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              error={errors.vat_rate}
              hint={t('invoices.vatHint')}
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={`${t('invoices.advance')}${totals.total > 0 ? ' *' : ''}`}
              type="number"
              min={0}
              step="0.01"
              required={totals.total > 0}
              value={advance}
              onChange={(e) => setAdvance(e.target.value)}
              error={errors.advance}
              hint={needsPaymentProof ? t('invoices.declaredAdvanceHint') : t('invoices.advanceHint')}
              />
              <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('invoices.headerComment')}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('invoices.headerCommentPlaceholder')}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500 dark:text-gray-400">{t('invoices.totalAfterDiscount')}</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(totals.subtotal, currency)}
              </span>
            </div>
            {totals.discount > 0 && (
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-gray-500 dark:text-gray-400">- {t('invoices.discount')}</span>
                <span className="text-lg font-semibold text-error-500">
                  - {formatCurrency(totals.discount, currency)}
                </span>
              </div>
            )}
            {totals.vat > 0 && (
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-gray-500 dark:text-gray-400">{t('invoices.vatAmount')}</span>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  + {formatCurrency(totals.vat, currency)}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500 dark:text-gray-400">{t('invoices.totalAmount')}</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(totals.total, currency)}
              </span>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500 dark:text-gray-400">{t('invoices.balanceDue')}</span>
              <span className="text-lg font-semibold text-brand-600 dark:text-brand-400">
                {formatCurrency(totals.balance, currency)}
              </span>
            </div>
            <Button
              type="submit"
              isLoading={submitting}
              disabled={needsPaymentProof && !proofFile}
              title={needsPaymentProof && !proofFile ? t('invoices.proofRequiredForSale') : undefined}
            >
              {needsPaymentProof ? t('invoices.createSubmitPending') : t('invoices.createSubmit')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
