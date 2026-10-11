import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '@/i18n';
import { formatCurrency, formatNumber } from '@/utils/number';
import type {
  CommercialMonthlyResponse,
  CommercialMonthlyTab,
} from '@/api/reports.api';
import logoUrl from '@/assets/pekegno-logo.png';

type Scope = 'academy' | 'agency';

function TabSection({ tab }: { tab: CommercialMonthlyTab }) {
  const { t } = useTranslation();
  const { totals, by_activity, by_city, by_week, annexe } = tab;
  const hasData = totals.lines > 0;

  const topActivity = by_activity[0];
  const topCity = by_city[0];

  const analysis = [
    t('reports.monthly.analysis.intro', {
      lines: formatNumber(totals.lines),
      billed: formatCurrency(totals.billed),
      received: formatCurrency(totals.received),
      rate: formatNumber(totals.collection_rate),
      balance: formatCurrency(totals.balance_due),
    }),
  ];
  if (topActivity) {
    analysis.push(
      t('reports.monthly.analysis.topActivity', {
        activity: topActivity.activity,
        amount: formatCurrency(topActivity.billed),
      }),
    );
  }
  if (topCity) {
    analysis.push(
      t('reports.monthly.analysis.topCity', {
        city: topCity.city,
        amount: formatCurrency(topCity.billed),
      }),
    );
  }

  const highlights: string[] = [];
  if (totals.collection_rate >= 80) {
    highlights.push(t('reports.monthly.highlight.collectionGood', { rate: formatNumber(totals.collection_rate) }));
  }
  if (topActivity) {
    highlights.push(t('reports.monthly.highlight.topActivity', { activity: topActivity.activity, amount: formatCurrency(topActivity.billed) }));
  }
  if (topCity) {
    highlights.push(t('reports.monthly.highlight.topCity', { city: topCity.city, amount: formatCurrency(topCity.billed) }));
  }

  const watchpoints: string[] = [];
  if (totals.balance_due > 0) {
    watchpoints.push(t('reports.monthly.watch.balance', { amount: formatCurrency(totals.balance_due) }));
  }
  by_city
    .filter((c) => c.billed > 0 && c.received === 0)
    .forEach((c) => watchpoints.push(t('reports.monthly.watch.cityNoCollection', { city: c.city })));
  const weeksWithData = by_week.filter((w) => w.billed > 0);
  if (weeksWithData.length >= 2) {
    const first = weeksWithData[0];
    const last = weeksWithData[weeksWithData.length - 1];
    if (last.billed < first.billed) {
      watchpoints.push(t('reports.monthly.watch.slowdown', { week: last.week }));
    }
  }

  const actions: string[] = [];
  if (totals.balance_due > 0) {
    actions.push(t('reports.monthly.action.collect', { amount: formatCurrency(totals.balance_due) }));
  }
  if (topCity) {
    actions.push(t('reports.monthly.action.develop', { city: topCity.city }));
  }
  actions.push(t('reports.monthly.action.prospect'));

  const th = 'border border-gray-300 px-2 py-1 text-left font-semibold';
  const td = 'border border-gray-300 px-2 py-1';
  const tdRight = `${td} text-right whitespace-nowrap`;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t('reports.monthly.kpi.received'), value: formatCurrency(totals.received) },
          { label: t('reports.monthly.kpi.billed'), value: formatCurrency(totals.billed) },
          { label: t('reports.monthly.kpi.collectionRate'), value: `${formatNumber(totals.collection_rate)} %` },
          { label: t('reports.monthly.kpi.balanceDue'), value: formatCurrency(totals.balance_due) },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-gray-300 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">{k.label}</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{k.value}</p>
          </div>
        ))}
      </div>

      <section>
        <h3 className="mb-2 text-sm font-bold text-gray-900">{t('reports.monthly.sections.byActivity')}</h3>
        {by_activity.length === 0 ? (
          <p className="text-xs text-gray-500">{t('reports.monthly.noData')}</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className={th}>{t('reports.monthly.columns.activity')}</th>
                <th className={`${th} text-right`}>{t('reports.monthly.columns.lines')}</th>
                <th className={`${th} text-right`}>{t('reports.monthly.columns.billed')}</th>
                <th className={`${th} text-right`}>{t('reports.monthly.columns.received')}</th>
                <th className={`${th} text-right`}>{t('reports.monthly.columns.balance')}</th>
              </tr>
            </thead>
            <tbody>
              {by_activity.map((r) => (
                <tr key={r.activity}>
                  <td className={td}>{r.activity}</td>
                  <td className={tdRight}>{formatNumber(r.lines)}</td>
                  <td className={tdRight}>{formatCurrency(r.billed)}</td>
                  <td className={tdRight}>{formatCurrency(r.received)}</td>
                  <td className={tdRight}>{formatCurrency(r.balance)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className={td}>{t('reports.monthly.total')}</td>
                <td className={tdRight}>{formatNumber(totals.lines)}</td>
                <td className={tdRight}>{formatCurrency(totals.billed)}</td>
                <td className={tdRight}>{formatCurrency(totals.received)}</td>
                <td className={tdRight}>{formatCurrency(totals.balance_due)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-gray-900">{t('reports.monthly.sections.byCity')}</h3>
        {by_city.length === 0 ? (
          <p className="text-xs text-gray-500">{t('reports.monthly.noData')}</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className={th}>{t('reports.monthly.columns.city')}</th>
                <th className={`${th} text-right`}>{t('reports.monthly.columns.lines')}</th>
                <th className={`${th} text-right`}>{t('reports.monthly.columns.billed')}</th>
                <th className={`${th} text-right`}>{t('reports.monthly.columns.received')}</th>
                <th className={`${th} text-right`}>{t('reports.monthly.columns.share')}</th>
              </tr>
            </thead>
            <tbody>
              {by_city.map((r) => (
                <tr key={r.city}>
                  <td className={td}>{r.city}</td>
                  <td className={tdRight}>{formatNumber(r.lines)}</td>
                  <td className={tdRight}>{formatCurrency(r.billed)}</td>
                  <td className={tdRight}>{formatCurrency(r.received)}</td>
                  <td className={tdRight}>{formatNumber(r.share)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-gray-900">{t('reports.monthly.sections.byWeek')}</h3>
        {by_week.length === 0 ? (
          <p className="text-xs text-gray-500">{t('reports.monthly.noData')}</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className={th}>{t('reports.monthly.columns.week')}</th>
                <th className={th}>{t('reports.monthly.columns.period')}</th>
                <th className={`${th} text-right`}>{t('reports.monthly.columns.lines')}</th>
                <th className={`${th} text-right`}>{t('reports.monthly.columns.billed')}</th>
                <th className={`${th} text-right`}>{t('reports.monthly.columns.received')}</th>
              </tr>
            </thead>
            <tbody>
              {by_week.map((r) => (
                <tr key={r.week}>
                  <td className={td}>{t('reports.monthly.weekLabel', { number: r.week })}</td>
                  <td className={td}>
                    {new Date(`${r.start}T12:00:00`).toLocaleDateString(currentLocale(), { day: '2-digit', month: '2-digit' })}
                    {' → '}
                    {new Date(`${r.end}T12:00:00`).toLocaleDateString(currentLocale(), { day: '2-digit', month: '2-digit' })}
                  </td>
                  <td className={tdRight}>{formatNumber(r.lines)}</td>
                  <td className={tdRight}>{formatCurrency(r.billed)}</td>
                  <td className={tdRight}>{formatCurrency(r.received)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-gray-900">{t('reports.monthly.sections.analysis')}</h3>
        {!hasData ? (
          <p className="text-xs text-gray-500">{t('reports.monthly.noData')}</p>
        ) : (
          <div className="flex flex-col gap-3 text-xs text-gray-700">
            <p>{analysis.join(' ')}</p>
            {highlights.length > 0 && (
              <div>
                <p className="font-semibold text-gray-900">{t('reports.monthly.sections.highlights')}</p>
                <ul className="ml-4 list-disc">
                  {highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
            {watchpoints.length > 0 && (
              <div>
                <p className="font-semibold text-gray-900">{t('reports.monthly.sections.watchpoints')}</p>
                <ul className="ml-4 list-disc">
                  {watchpoints.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900">{t('reports.monthly.sections.actionPlan')}</p>
              <ol className="ml-4 list-decimal">
                {actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-gray-900">{t('reports.monthly.sections.annex')}</h3>
        {annexe.length === 0 ? (
          <p className="text-xs text-gray-500">{t('reports.monthly.noData')}</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className={th}>{t('reports.monthly.columns.date')}</th>
                <th className={th}>{t('reports.monthly.columns.client')}</th>
                <th className={th}>{t('reports.monthly.columns.city')}</th>
                <th className={th}>{t('reports.monthly.columns.activity')}</th>
                <th className={`${th} text-right`}>{t('reports.monthly.columns.total')}</th>
                <th className={`${th} text-right`}>{t('reports.monthly.columns.paid')}</th>
                <th className={`${th} text-right`}>{t('reports.monthly.columns.balance')}</th>
              </tr>
            </thead>
            <tbody>
              {annexe.map((r, i) => (
                <tr key={`${r.date}-${r.client}-${i}`}>
                  <td className={td}>{new Date(`${r.date}T12:00:00`).toLocaleDateString(currentLocale())}</td>
                  <td className={td}>{r.client}</td>
                  <td className={td}>{r.city}</td>
                  <td className={td}>{r.activity}</td>
                  <td className={tdRight}>{formatCurrency(r.total)}</td>
                  <td className={tdRight}>{formatCurrency(r.paid)}</td>
                  <td className={tdRight}>{formatCurrency(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Header({ data }: { data: CommercialMonthlyResponse }) {
  const { t } = useTranslation();
  const name = [data.commercial.first_name, data.commercial.last_name].filter(Boolean).join(' ');
  const from = new Date(`${data.period.from}T12:00:00`).toLocaleDateString(currentLocale(), { day: '2-digit', month: 'long', year: 'numeric' });
  const to = new Date(`${data.period.to}T12:00:00`).toLocaleDateString(currentLocale(), { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <header className="mb-5 flex items-start justify-between gap-4 border-b-2 border-brand-500 pb-3">
      <div className="flex items-center gap-3">
        <img src={logoUrl} alt="PEKEGNO" className="h-12 w-auto" />
        <div>
          <p className="text-lg font-bold text-gray-900">PEKEGNO</p>
          <p className="text-xs text-gray-500">{t('reports.monthly.subtitle')}</p>
        </div>
      </div>
      <div className="text-right text-xs text-gray-700">
        <p className="text-sm font-bold text-gray-900">{t('reports.monthly.title')}</p>
        <p className="mt-1">{t('reports.monthly.commercial')} : <span className="font-semibold">{name || '—'}</span></p>
        {data.commercial.agency_name && (
          <p>{t('reports.monthly.agency')} : <span className="font-semibold">{data.commercial.agency_name}</span></p>
        )}
        <p>{t('reports.monthly.period')} : {from} — {to}</p>
      </div>
    </header>
  );
}

function ScopeHeading({ scope }: { scope: Scope }) {
  const { t } = useTranslation();
  return (
    <h2 className="mt-6 mb-3 border-l-4 border-brand-500 pl-2 text-base font-bold uppercase tracking-wide text-gray-900">
      {scope === 'academy' ? t('reports.monthly.tabAcademy') : t('reports.monthly.tabAgency')}
    </h2>
  );
}

/**
 * Feuille de rapport commercial mensuel, utilisée telle quelle à l'écran comme
 * dans le portail d'impression. `scope="all"` imprime les deux volets
 * (Académie puis Agency) ; un `scope` précis n'affiche qu'un volet.
 */
export function CommercialMonthlyReportSheet({
  data,
  scope,
}: {
  data: CommercialMonthlyResponse;
  scope: 'all' | Scope;
}) {
  return (
    <div className="bg-white px-8 py-7 text-[12px] leading-snug text-gray-900" style={{ fontFamily: 'Verdana, Arial, sans-serif' }}>
      <Header data={data} />
      {scope === 'all' ? (
        <>
          <ScopeHeading scope="academy" />
          <TabSection tab={data.tabs.academy} />
          <ScopeHeading scope="agency" />
          <TabSection tab={data.tabs.agency} />
        </>
      ) : (
        <TabSection tab={data.tabs[scope]} />
      )}
    </div>
  );
}

/** Portail d'impression : seul `#commercial-report-print` est imprimé (voir index.css). */
export function CommercialMonthlyReportPrintPortal({ data }: { data: CommercialMonthlyResponse }) {
  return createPortal(
    <div id="commercial-report-print">
      <CommercialMonthlyReportSheet data={data} scope="all" />
    </div>,
    document.body,
  );
}
