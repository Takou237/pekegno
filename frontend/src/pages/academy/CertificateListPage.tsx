import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Ban } from 'lucide-react';
import { certificatesApi } from '@/api/certificates.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/Skeleton';
import type { Certificate } from '@/types/certificate';
import type { PaginationMeta } from '@/types/agency';

const STATUS_BADGES: Record<string, string> = {
  issued: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  revoked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export default function CertificateListPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({ enrollment_id: '', mention: '' });
  const [issueErrors, setIssueErrors] = useState<Record<string, string>>({});
  const [issuing, setIssuing] = useState(false);

  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    certificatesApi
      .list({
        status: filterStatus || undefined,
        page,
        per_page: 15,
      })
      .then((res) => {
        setCertificates(res.data);
        setMeta({ current_page: res.current_page, last_page: res.last_page, total: res.total, per_page: res.per_page });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterStatus, page]);

  useEffect(() => {
    load();
  }, [load]);

  function extractFieldErrors(error: unknown): Record<string, string> {
    const err = error as { response?: { data?: { errors?: Record<string, string[]> } } };
    const fields = err?.response?.data?.errors;
    if (!fields) return { general: extractErrorMessage(error, t('common.error')) };
    const result: Record<string, string> = {};
    for (const [key, messages] of Object.entries(fields)) {
      result[key] = messages[0] ?? '';
    }
    return result;
  }

  async function handleIssue(e: FormEvent) {
    e.preventDefault();
    setIssuing(true);
    setIssueErrors({});
    try {
      await certificatesApi.create({
        enrollment_id: issueForm.enrollment_id,
        mention: issueForm.mention || undefined,
      });
      showToast(t('certificates.issued'), 'success');
      setIssueOpen(false);
      setIssueForm({ enrollment_id: '', mention: '' });
      load();
    } catch (error) {
      setIssueErrors(extractFieldErrors(error));
    } finally {
      setIssuing(false);
    }
  }

  async function handleRevoke() {
    if (!revokeTarget || !revokeReason.trim()) return;
    setRevoking(true);
    try {
      await certificatesApi.revoke(revokeTarget, revokeReason);
      showToast(t('certificates.revoked'), 'success');
      setRevokeOpen(false);
      setRevokeReason('');
      setRevokeTarget('');
      load();
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('certificates.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('certificates.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => setIssueOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('certificates.issue')}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('common.status')}
            </label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="">{t('common.all')}</option>
              <option value="issued">{t('certificates.statusIssued')}</option>
              <option value="revoked">{t('certificates.statusRevoked')}</option>
            </select>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={5} />
        ) : certificates.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('certificates.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('certificates.number')}</th>
                  <th className="px-5 py-3 font-medium">{t('nav.learners')}</th>
                  <th className="px-5 py-3 font-medium">{t('nav.courses')}</th>
                  <th className="px-5 py-3 font-medium">{t('certificates.issuedOn')}</th>
                  <th className="px-5 py-3 font-medium">{t('certificates.mention')}</th>
                  <th className="px-5 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {certificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{cert.number}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {cert.enrollment?.learner
                        ? [cert.enrollment.learner.first_name, cert.enrollment.learner.last_name]
                            .filter(Boolean)
                            .join(' ') || '—'
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {cert.enrollment?.course?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {new Date(cert.issued_on).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{cert.mention ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[cert.status]}`}>
                        {t(`certificates.status${cert.status.charAt(0).toUpperCase() + cert.status.slice(1)}`)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {cert.status === 'issued' && (
                          <button
                            type="button"
                            onClick={() => { setRevokeTarget(cert.id); setRevokeOpen(true); }}
                            className="rounded p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title={t('certificates.revoke')}
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.last_page > 1 && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Pagination
              currentPage={meta.current_page}
              lastPage={meta.last_page}
              total={meta.total}
              perPage={meta.per_page}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Issue modal */}
      <Modal isOpen={issueOpen} onClose={() => setIssueOpen(false)} title={t('certificates.issue')} maxWidth="max-w-md">
        <form onSubmit={handleIssue} className="flex flex-col gap-4">
          {issueErrors.general && <Alert variant="error">{issueErrors.general}</Alert>}
          <Input
            label={t('certificates.enrollmentId')}
            required
            value={issueForm.enrollment_id}
            onChange={(e) => setIssueForm({ ...issueForm, enrollment_id: e.target.value })}
            error={issueErrors.enrollment_id}
          />
          <Input
            label={t('certificates.mention')}
            value={issueForm.mention}
            onChange={(e) => setIssueForm({ ...issueForm, mention: e.target.value })}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIssueOpen(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={issuing} className="flex-1">
              {t('common.confirm')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Revoke modal */}
      <Modal isOpen={revokeOpen} onClose={() => setRevokeOpen(false)} title={t('certificates.revoke')} maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          <Input
            label={t('certificates.revokeReason')}
            required
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setRevokeOpen(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button onClick={handleRevoke} disabled={!revokeReason.trim()} isLoading={revoking} className="flex-1">{t('common.confirm')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
