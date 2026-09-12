import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { clientApi } from '@/api/client.api';
import type { FormationEnrollment } from '@/types';
import { formatDate } from '@/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { GraduationCap } from 'lucide-react';

export default function FormationsPage() {
  const { t } = useTranslation();
  const [enrollments, setEnrollments] = useState<FormationEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clientApi.getEnrollments()
      .then((r) => setEnrollments((r as { data?: FormationEnrollment[] }).data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner className="py-20" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('account.formations')}</h1>

      {enrollments.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow-sm border border-gray-100">{t('account.noFormations')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {enrollments.map((en) => (
            <div key={en.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <GraduationCap size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900">{en.course?.name}</h3>
                  <p className="text-xs text-gray-400">Inscrit le {formatDate(en.enrolled_at)}</p>
                </div>
              </div>
              <Badge variant={en.status === 'active' ? 'success' : 'neutral'}>{t(`status.${en.status}`)}</Badge>
              {en.course?.description && <p className="mt-3 text-sm text-gray-500 line-clamp-2">{en.course.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
