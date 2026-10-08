import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { agencyApi, type ClientPrestation, type ClientPrestationAction } from '@/api/agency.api';
import { formatDate } from '@/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

function Stars({ value, onChange, size = 18 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <span className="inline-flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onMouseEnter={() => onChange && setHover(n)}
          onClick={() => onChange?.(n)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
          aria-label={`${n}`}
        >
          <Star size={size} className={n <= shown ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
        </button>
      ))}
    </span>
  );
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'neutral' | 'brand'> = {
  validated: 'brand',
  in_progress: 'success',
  completed: 'neutral',
  suspended: 'warning',
};

/**
 * « Mes prestations » : le client suit ses prestations Agency et note chaque
 * action sur 5 étoiles (une note par action, modifiable quand il veut, si la
 * prestation est en cours ou terminée).
 */
export default function PrestationsPage() {
  const { t } = useTranslation();
  const [prestations, setPrestations] = useState<ClientPrestation[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    agencyApi.prestations().then(setPrestations).catch(() => setPrestations([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!prestations) return <Spinner className="py-20" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('agency.myPrestations')}</h1>
      <p className="text-sm text-gray-500 mb-6">{t('agency.subtitle')}</p>

      {prestations.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow-sm border border-gray-100">{t('agency.empty')}</div>
      ) : (
        <div className="space-y-4">
          {prestations.map((p) => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100">
              <button type="button" onClick={() => setOpenId(openId === p.id ? null : p.id)} className="w-full flex items-start gap-3 p-5 text-left">
                <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <Briefcase size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{p.name}</h3>
                    <Badge variant={STATUS_VARIANT[p.status] ?? 'neutral'}>{t(`agency.status.${p.status}`)}</Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.reference} · {formatDate(p.start_date)} → {formatDate(p.end_date)}
                    {p.package ? ` · ${p.package.name}` : ''}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                    <Stars value={Math.round(p.rating_avg ?? 0)} size={14} />
                    {p.rating_avg != null ? `${p.rating_avg.toFixed(1)} · ${t('agency.reviews', { count: p.rating_count })}` : t('agency.notRated')}
                  </div>
                </div>
                {openId === p.id ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </button>
              {openId === p.id && <PrestationActions prestationId={p.id} onRated={load} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PrestationActions({ prestationId, onRated }: { prestationId: string; onRated: () => void }) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<ClientPrestation | null>(null);

  const load = useCallback(() => {
    agencyApi.prestation(prestationId).then(setDetail).catch(() => {});
  }, [prestationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!detail) return <Spinner className="py-6" />;

  return (
    <div className="border-t border-gray-100 px-5 py-4">
      {!detail.can_rate && <p className="mb-3 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{t('agency.rateLater')}</p>}
      <ul className="divide-y divide-gray-100">
        {(detail.actions ?? []).map((a) => (
          <ActionRow key={a.id} action={a} onSaved={() => { load(); onRated(); }} />
        ))}
      </ul>
    </div>
  );
}

function ActionRow({ action, onSaved }: { action: ClientPrestationAction; onSaved: () => void }) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(action.my_review?.rating ?? 0);
  const [comment, setComment] = useState(action.my_review?.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = rating !== (action.my_review?.rating ?? 0) || comment !== (action.my_review?.comment ?? '');

  async function save() {
    if (!rating) return;
    setSaving(true);
    setError(null);
    try {
      await agencyApi.rateAction(action.id, rating, comment);
      onSaved();
    } catch {
      setError(t('agency.rateError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{action.title}</p>
          <p className="text-xs text-gray-400">
            {action.quantity} × {t(`agency.frequency.${action.frequency}`)} · {t(`agency.actionStatus.${action.status}`, action.status)}
          </p>
        </div>
        <Stars value={rating} onChange={action.can_rate ? setRating : undefined} />
      </div>
      {action.can_rate && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('agency.commentPlaceholder')}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <Button size="sm" onClick={save} isLoading={saving} disabled={!rating || !dirty}>
            {action.my_review ? t('agency.updateRating') : t('agency.rate')}
          </Button>
        </div>
      )}
      {action.my_review && <p className="mt-1 text-xs text-gray-400">{t('agency.ratedOn', { date: formatDate(action.my_review.updated_at) })}</p>}
      {error && <p className="mt-1 text-xs text-error-600">{error}</p>}
    </li>
  );
}
