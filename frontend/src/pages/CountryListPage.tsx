import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, MapPin, ArrowRight, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { statsApi } from '@/api/stats.api';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CountryFormModal } from '@/components/countries/CountryFormModal';
import { canCreateCountry } from '@/utils/countryPermissions';
import { formatCurrency } from '@/utils/number';
import type { CountryStat } from '@/types/stats';

export default function CountryListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [countries, setCountries] = useState<CountryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    statsApi
      .group()
      .then((stats) => {
        if (active) setCountries(stats.countries ?? []);
      })
      .catch((err) => {
        if (active) setError(err?.response?.data?.message ?? err?.message ?? 'Erreur');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [refreshKey]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            <Globe className="mr-2 inline h-5 w-5 text-brand-600" />
            {t('countries.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('dashboard.groupSubtitle')}
          </p>
        </div>
        {canCreateCountry(user) && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('countries.newCountry')}
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : countries.length === 0 ? (
        <p className="text-sm text-gray-400">{t('countries.empty')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {countries.map((c) => (
            <Link
              key={c.id}
              to={`/countries/${c.id}`}
              className="group flex flex-col rounded-2xl border border-gray-100 bg-white p-5 transition-shadow hover:border-brand-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/40"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white">{c.name}</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xs text-gray-400">{c.code}</p>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-400">{c.currency_code}</span>
                    <Badge variant={c.is_active ? 'success' : 'neutral'}>
                      {c.is_active ? t('common.active') : t('common.inactive')}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {c.agencies_count}
                  </p>
                  <p className="text-xs text-gray-400">{t('dashboard.agencies')}</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(c.revenue)}
                  </p>
                  <p className="text-xs text-gray-400">{t('dashboard.revenue')}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <MapPin className="h-3.5 w-3.5" />
                  {formatCurrency(c.outstanding)} {t('dashboard.outstanding').toLowerCase()}
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400">
                  {t('dashboard.viewCountry')}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CountryFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
