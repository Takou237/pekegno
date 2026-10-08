import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { publicApi } from '@/api/public.api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatCurrency, packagePeriodLabel } from '@/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { PackageSubscribeModal } from '@/components/packages/PackageSubscribeModal';
import { ArrowLeft, Check, Clock, MapPin, Phone, Mail, Info, Building2, Users } from 'lucide-react';
import type { PublicPackage } from '@/types';

export default function PackageDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [pkg, setPkg] = useState<PublicPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgencyId, setSelectedAgencyId] = useState('');
  const [showSubscribe, setShowSubscribe] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    publicApi
      .getPackage(id)
      .then((data) => {
        setPkg(data);
        setSelectedAgencyId(data.agencies[0]?.id ?? data.agency?.id ?? '');
      })
      .catch(() => setPkg(null))
      .finally(() => setLoading(false));
  }, [id]);

  // « Souscrire » depuis la carte du catalogue : la fiche s'ouvre avec le formulaire.
  useEffect(() => {
    if (pkg && isAuthenticated && searchParams.get('subscribe') === '1') {
      setShowSubscribe(true);
    }
  }, [pkg, isAuthenticated, searchParams]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Spinner />
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">{t('packages.notFound')}</p>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
          <ArrowLeft size={16} /> {t('packages.backToCatalog')}
        </Link>
      </div>
    );
  }

  const offer = pkg.agencies.find((agency) => agency.id === selectedAgencyId) ?? pkg.agencies[0] ?? null;
  const subscribedPackageId = offer?.package_id ?? pkg.id;
  const unitPrice = Number(pkg.effective_price);

  const hasDiscount = !!pkg.original_price && Number(pkg.original_price) > unitPrice;
  const activePromo = pkg.promotions.find((promo) => promo.is_active);
  const country = typeof offer?.country === 'string' ? offer.country : null;

  const openSubscribe = () => {
    if (!isAuthenticated) {
      showToast(t('packages.loginToSubscribe'), 'info');
      navigate('/connexion');
      return;
    }
    setShowSubscribe(true);
  };

  const closeSubscribe = () => {
    setShowSubscribe(false);
    if (searchParams.get('subscribe')) {
      const next = new URLSearchParams(searchParams);
      next.delete('subscribe');
      setSearchParams(next, { replace: true });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 mb-6">
        <ArrowLeft size={16} /> {t('common.back')}
      </Link>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {pkg.cover_image ? (
          <div className="relative h-56 md:h-72 bg-gray-100">
            <img src={pkg.cover_image} alt={pkg.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="h-40 bg-gradient-to-br from-brand-50 to-brand-100" />
        )}

        <div className="p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full">
              {t('catalog.typePackages')}
            </span>
            {pkg.category && <span className="text-xs text-gray-400">{pkg.category.name}</span>}
            {pkg.code && <span className="text-xs text-gray-400">{t('packages.code')} : {pkg.code}</span>}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{pkg.name}</h1>
          {pkg.tagline && <p className="text-gray-500 mb-6">{pkg.tagline}</p>}

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <div className="flex flex-wrap items-end gap-3">
              <p className="text-3xl font-bold text-brand-600">
                {pkg.price_is_starting_from && (
                  <span className="text-sm font-medium text-gray-500 mr-1">{t('packages.startingFrom')}</span>
                )}
                {formatCurrency(pkg.effective_price)}
                <span className="text-sm font-medium text-gray-500 ml-1">{t(packagePeriodLabel(pkg.billing_period))}</span>
              </p>
              {hasDiscount && (
                <p className="text-sm text-gray-400 line-through">{formatCurrency(pkg.original_price as string)}</p>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
              {pkg.min_duration_months ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={14} className="text-gray-400" />
                  {t('packages.minDuration', { count: pkg.min_duration_months })}
                </span>
              ) : null}
              {activePromo && (activePromo.discount_percent || activePromo.promo_price) && (
                <span className="inline-flex items-center gap-1.5 font-medium text-brand-600">
                  {activePromo.discount_percent ? `-${activePromo.discount_percent}%` : formatCurrency(activePromo.promo_price as string)}
                </span>
              )}
            </div>
          </div>

          {pkg.agencies.length > 1 && (
            <div className="mb-5">
              <label htmlFor="agency-select" className="block text-sm font-medium text-gray-700 mb-1">
                {t('packages.chooseAgency')}
              </label>
              <select
                id="agency-select"
                value={selectedAgencyId}
                onChange={(e) => setSelectedAgencyId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              >
                {pkg.agencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                    {agency.city ? ` — ${agency.city}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="bg-brand-50 rounded-lg p-5 mb-6">
            <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-900">
              <Building2 size={16} className="text-brand-600" />
              {offer ? offer.name : pkg.agency ? pkg.agency.name : t('packages.agency')}
            </div>
            {offer && (
              <p className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
                <MapPin size={14} className="text-gray-400" />
                {[offer.city, country].filter(Boolean).join(' · ')}
              </p>
            )}
            {offer?.phone && (
              <a href={`tel:${offer.phone}`} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-brand-600">
                <Phone size={14} className="text-gray-400" />
                {offer.phone}
              </a>
            )}
            {offer?.email && (
              <a href={`mailto:${offer.email}`} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-brand-600">
                <Mail size={14} className="text-gray-400" />
                {offer.email}
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 mb-6">
            <Button onClick={openSubscribe}>{t('packages.subscribe')}</Button>
            <p className="flex items-start gap-1.5 text-xs text-gray-500">
              <Info size={14} className="mt-0.5 shrink-0 text-gray-400" />
              {t('packages.readOnly')}
            </p>
          </div>

          {pkg.description && (
            <section className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('product.description')}</h2>
              <p className="text-sm text-gray-600 whitespace-pre-line">{pkg.description}</p>
            </section>
          )}

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('packages.prerequisites')}</h2>
            {pkg.prerequisites ? (
              <p className="text-sm text-gray-600 whitespace-pre-line">{pkg.prerequisites}</p>
            ) : (
              <p className="text-sm text-gray-500">{t('packages.noPrerequisites')}</p>
            )}
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('packages.includes')}</h2>
            {pkg.items.length === 0 ? (
              <p className="text-sm text-gray-500">{t('packages.noIncludes')}</p>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-2">
                {pkg.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                    <Check size={16} className="mt-0.5 shrink-0 text-brand-600" />
                    <span>
                      {item.label}
                      {item.quantity ? <span className="text-gray-400"> — ×{item.quantity}</span> : null}
                      {item.frequency ? <span className="block text-xs text-gray-400">{item.frequency}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('packages.recommendations')}</h2>
            {pkg.recommendations.length === 0 ? (
              <p className="text-sm text-gray-500">{t('packages.noRecommendations')}</p>
            ) : (
              <ul className="space-y-2">
                {pkg.recommendations.map((rec) => (
                  <li key={rec.id} className="flex items-center justify-between gap-3 text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                    <span className="inline-flex items-center gap-2">
                      <Check size={16} className="shrink-0 text-brand-600" />
                      {rec.label}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap">
                      <Users size={14} className="text-gray-400" />×{rec.quantity}
                      {rec.teamRole && <span className="text-gray-400">— {rec.teamRole.name}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {showSubscribe && (
        <PackageSubscribeModal
          packageId={subscribedPackageId}
          pkg={pkg}
          onClose={closeSubscribe}
        />
      )}
    </div>
  );
}
