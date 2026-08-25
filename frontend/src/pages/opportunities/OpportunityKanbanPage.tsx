import { useCallback, useEffect, useState, type FormEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, GripVertical, Building2, Filter, RefreshCw } from 'lucide-react';
import { opportunitiesApi } from '@/api/opportunities.api';
import { companiesApi } from '@/api/companies.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import type { Opportunity, OpportunityStage, PipelineEntry } from '@/types/opportunity';
import { STAGE_LABELS, STAGE_COLORS, OPEN_STAGES } from '@/types/opportunity';
import type { Company } from '@/types/company';

const ALL_STAGES: OpportunityStage[] = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

export default function OpportunityKanbanPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [pipeline, setPipeline] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCommercial, setFilterCommercial] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createStage, setCreateStage] = useState<OpportunityStage>('new');
  const [form, setForm] = useState({ title: '', expected_amount: '', company_id: '', agency_id: '', commercial_id: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [draggedOpp, setDraggedOpp] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      opportunitiesApi.list({ per_page: 200, commercial_id: filterCommercial || undefined, search: filterSearch || undefined }),
      opportunitiesApi.pipeline(),
      companiesApi.list({ per_page: 100 }),
    ])
      .then(([oppsRes, pipeRes, coRes]) => {
        setOpportunities(oppsRes.data);
        setPipeline(pipeRes);
        setCompanies(coRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterCommercial, filterSearch]);

  useEffect(() => { load(); }, [load]);

  const stageGroups = ALL_STAGES.reduce((acc, stage) => {
    acc[stage] = opportunities.filter((o) => o.stage === stage);
    return acc;
  }, {} as Record<OpportunityStage, Opportunity[]>);

  function handleDragStart(e: React.DragEvent, oppId: string) {
    setDraggedOpp(oppId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  async function handleDrop(e: React.DragEvent, targetStage: OpportunityStage) {
    e.preventDefault();
    if (!draggedOpp) return;

    const opp = opportunities.find((o) => o.id === draggedOpp);
    if (!opp || opp.stage === targetStage) {
      setDraggedOpp(null);
      return;
    }

    try {
      await opportunitiesApi.changeStage(draggedOpp, targetStage);
      setOpportunities((prev) =>
        prev.map((o) => (o.id === draggedOpp ? { ...o, stage: targetStage } : o))
      );
      setPipeline((prev) => {
        const updated = prev.map((p) => {
          if (p.stage === opp.stage) return { ...p, count: p.count - 1, total_amount: p.total_amount - (Number(opp.expected_amount) || 0) };
          if (p.stage === targetStage) return { ...p, count: p.count + 1, total_amount: p.total_amount + (Number(opp.expected_amount) || 0) };
          return p;
        });
        return updated;
      });
      showToast(t('opportunities.stageMoved'), 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, t('opportunities.error')), 'error');
    } finally {
      setDraggedOpp(null);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors({});
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        stage: createStage,
        agency_id: form.agency_id,
        commercial_id: form.commercial_id,
      };
      if (form.expected_amount) payload.expected_amount = Number(form.expected_amount);
      if (form.company_id) payload.company_id = form.company_id;
      await opportunitiesApi.create(payload as never);
      setCreateOpen(false);
      setForm({ title: '', expected_amount: '', company_id: '', agency_id: '', commercial_id: '' });
      showToast(t('opportunities.created'), 'success');
      load();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data;
      if (data?.errors) {
        const fe: Record<string, string> = {};
        Object.entries(data.errors).forEach(([k, v]) => { fe[k] = v[0]; });
        setFormErrors(fe);
      } else {
        showToast(extractErrorMessage(err, t('opportunities.error')), 'error');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const totalAmount = pipeline.reduce((s, p) => s + Number(p.total_amount || 0), 0);
  const totalOpps = pipeline.reduce((s, p) => s + p.count, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('opportunities.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('opportunities.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => { setCreateStage('new'); setCreateOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> {t('opportunities.newOpportunity')}
          </Button>
        </div>
      </div>

      {/* Filters & summary */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-900">
          <Filter className="h-4 w-4 text-gray-400" />
          <input
            className="bg-transparent text-sm outline-none placeholder:text-gray-400"
            placeholder={t('opportunities.searchPlaceholder')}
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
        </div>
        <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          {totalOpps} {t('opportunities.totalOpps')} · {formatCurrency(totalAmount)}
        </div>
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
          {ALL_STAGES.map((stage) => {
            const opps = stageGroups[stage];
            const pipeEntry = pipeline.find((p) => p.stage === stage);
            return (
              <div
                key={stage}
                className="flex w-72 min-w-[18rem] flex-col rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage)}
              >
                <div className={`flex items-center justify-between rounded-t-xl border-b px-4 py-3 ${STAGE_COLORS[stage]}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{STAGE_LABELS[stage]}</span>
                    <span className="inline-flex items-center justify-center rounded-full bg-white/60 px-2 py-0.5 text-xs font-bold dark:bg-black/30">
                      {pipeEntry?.count ?? opps.length}
                    </span>
                  </div>
                  {OPEN_STAGES.includes(stage) && (
                    <button
                      onClick={() => { setCreateStage(stage); setCreateOpen(true); }}
                      className="rounded p-0.5 hover:bg-white/50 dark:hover:bg-black/30"
                      title={t('opportunities.addToStage')}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2" style={{ maxHeight: '60vh' }}>
                  {opps.length === 0 ? (
                    <p className="py-8 text-center text-xs text-gray-400">{t('opportunities.noOpps')}</p>
                  ) : (
                    opps.map((opp) => (
                      <div
                        key={opp.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, opp.id)}
                        className={`cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800 ${draggedOpp === opp.id ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start justify-between">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-2">{opp.title}</p>
                          <GripVertical className="h-4 w-4 flex-shrink-0 text-gray-300" />
                        </div>
                        {opp.company && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                            <Building2 className="h-3 w-3" />
                            {opp.company.name}
                          </div>
                        )}
                        {opp.expected_amount != null && (
                          <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                            {formatCurrency(opp.expected_amount)}
                          </p>
                        )}
                        {opp.commercial && (
                          <p className="mt-1 text-xs text-gray-400">
                            {opp.commercial.first_name} {opp.commercial.last_name}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {opps.length > 0 && (
                  <div className="border-t border-gray-200 px-4 py-2 text-xs font-medium text-gray-500 dark:border-gray-700">
                    {formatCurrency(opps.reduce((s, o) => s + (Number(o.expected_amount) || 0), 0))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title={t('opportunities.newOpportunity')} size="md">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input
            label={t('opportunities.titleField')}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            error={formErrors.title}
            required
          />
          <Input
            label={t('opportunities.expectedAmount')}
            type="number"
            value={form.expected_amount}
            onChange={(e) => setForm({ ...form, expected_amount: e.target.value })}
            error={formErrors.expected_amount}
          />
          <div className="text-xs text-gray-500">{t('opportunities.stageLabel')}: {STAGE_LABELS[createStage]}</div>
          <Input
            label={t('opportunities.agencyId')}
            value={form.agency_id}
            onChange={(e) => setForm({ ...form, agency_id: e.target.value })}
            error={formErrors.agency_id}
            required
          />
          <Input
            label={t('opportunities.commercialId')}
            value={form.commercial_id}
            onChange={(e) => setForm({ ...form, commercial_id: e.target.value })}
            error={formErrors.commercial_id}
            required
          />
          <Input
            label={t('opportunities.companyId')}
            value={form.company_id}
            onChange={(e) => setForm({ ...form, company_id: e.target.value })}
            error={formErrors.company_id}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={submitting}>{submitting ? <Spinner className="h-4 w-4" /> : t('common.create')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
