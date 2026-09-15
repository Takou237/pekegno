import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, Coins, Wallet, CheckCircle2, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { commercialsApi } from '@/api/commercials.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/utils/number';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { currentLocale } from '@/i18n';
import type { Commercial, CommercialStats } from '@/types/commercial';

export default function CommercialCommissionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [commercial, setCommercial] = useState<Commercial | null>(null);
  const [stats, setStats] = useState<CommercialStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await commercialsApi.list({ per_page: 100 });
      const mine = (res.data ?? []).find((c) => c.user_id === user?.id) ?? null;
      setCommercial(mine);
      if (mine) {
        setStats(await commercialsApi.stats(mine.id));
      }
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('commercials.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (isLoading) {
    return <SkeletonDetail />;
  }

  if (loadError) {
    return <p className="text-sm text-error-500">{loadError}</p>;
  }

  if (!commercial || !stats) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('commercial.commissionsTitle')}</h1>
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercial.selfNoProfile')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('commercial.commissionsTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('commercial.commissionsSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercial.selfTurnover')}</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(stats.turnover)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-brand-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercial.commissionsEarned')}</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(stats.commissions_earned)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success-500" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercial.commissionsPaid')}</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(stats.commissions_paid)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-amber-500" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercial.commissionsOwed')}</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(stats.commissions)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercial.commissionsRank')}</p>
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
            {stats.rank.position ? `#${stats.rank.position}` : '—'}
            <span className="ml-1 text-sm font-normal text-gray-400">/ {stats.rank.total}</span>
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('commercial.commissionsHistory')}</h2>
        </div>
        {stats.commission_history.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('commercial.commissionsHistoryEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('common.date')}</th>
                  <th className="px-5 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-5 py-3 font-medium">{t('commercial.commissionsReference')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('common.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {stats.commission_history.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {row.date ? new Date(row.date).toLocaleDateString(currentLocale(), { dateStyle: 'medium' }) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {row.type === 'earned' ? (
                        <Badge variant="brand">{t('commercial.commissionsEarned')}</Badge>
                      ) : (
                        <Badge variant="success">{t('commercial.commissionsPaid')}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{row.reference ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">
                      {row.type === 'paid' ? '- ' : '+ '}
                      {formatCurrency(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
