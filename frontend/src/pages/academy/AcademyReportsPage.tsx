import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, CalendarDays, Users, DollarSign, TrendingUp } from 'lucide-react';
import { academyApi } from '@/api/academy.api';
import { invoicesApi } from '@/api/invoices.api';
import { extractErrorMessage } from '@/api/errors';
import { Alert } from '@/components/ui/Alert';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/utils/number';

interface DepartmentLayoutContext {
  department?: { id: string; agency_id?: string } | null;
  departmentId?: string;
  agencyId?: string;
}

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}

export default function AcademyReportsPage() {
  const { t } = useTranslation();
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!agencyId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [coursesRes, sessionsRes, enrollmentsRes, invoicesRes] = await Promise.allSettled([
        academyApi.courses({ agency_id: agencyId, per_page: 1 }),
        academyApi.sessions({ agency_id: agencyId, per_page: 1 }),
        academyApi.enrollments({ agency_id: agencyId, per_page: 1 }),
        invoicesApi.list({ agency_id: agencyId, per_page: 1 }),
      ]);

      const cards: StatCard[] = [];

      if (coursesRes.status === 'fulfilled') {
        cards.push({
          label: t('reports.totalFormations'),
          value: coursesRes.value.meta?.total ?? coursesRes.value.data.length,
          icon: BookOpen,
          color: 'bg-blue-500',
        });
      }

      if (sessionsRes.status === 'fulfilled') {
        cards.push({
          label: t('reports.totalSessions'),
          value: sessionsRes.value.meta?.total ?? sessionsRes.value.data.length,
          icon: CalendarDays,
          color: 'bg-purple-500',
        });
      }

      if (enrollmentsRes.status === 'fulfilled') {
        cards.push({
          label: t('reports.totalEnrollments'),
          value: enrollmentsRes.value.meta?.total ?? enrollmentsRes.value.data.length,
          icon: Users,
          color: 'bg-green-500',
        });
      }

      if (invoicesRes.status === 'fulfilled') {
        const revenue = invoicesRes.value.totals?.revenue ?? 0;
        const outstanding = invoicesRes.value.totals?.outstanding ?? 0;
        cards.push({
          label: t('reports.totalRevenue'),
          value: formatCurrency(revenue),
          icon: DollarSign,
          color: 'bg-amber-500',
        });
        cards.push({
          label: t('reports.outstanding'),
          value: formatCurrency(outstanding),
          icon: TrendingUp,
          color: 'bg-red-500',
        });
      }

      setStats(cards);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('common.error')));
    } finally {
      setIsLoading(false);
    }
  }, [agencyId, t]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.reports')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('reports.subtitle')}</p>
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {isLoading ? (
        <SkeletonCards count={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((card) => (
            <div
              key={card.label}
              className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.color} text-white`}>
                <card.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
