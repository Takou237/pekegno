import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { publicApi } from '@/api/public.api';
import { extractErrorMessage } from '@/api/client';
import type { CertificateVerification } from '@/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export default function CertificateVerificationPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [serial, setSerial] = useState(searchParams.get('numero') ?? '');
  const [result, setResult] = useState<CertificateVerification | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const data = await publicApi.verifyCertificate(serial.trim());
      setResult(data);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t('certificate.notFound')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold text-brand-600">PEKEGNO</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">{t('certificate.title')}</h1>
          <p className="text-sm text-gray-500 mt-2">{t('certificate.subtitle')}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('certificate.serialLabel')}
              placeholder={t('certificate.serialPlaceholder')}
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              required
            />
            <Button type="submit" isLoading={loading} fullWidth>{t('certificate.submit')}</Button>
          </form>

          {error && <div className="mt-4"><Alert variant="error">{error}</Alert></div>}

          {result && (
            <div className="mt-6 border-t border-gray-100 pt-6 space-y-4">
              <div
                className={`flex items-center gap-3 rounded-lg border p-4 text-sm font-medium ${
                  result.valid
                    ? 'border-success-200 bg-success-50 text-success-700'
                    : 'border-error-200 bg-error-50 text-error-700'
                }`}
              >
                {result.valid ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                {result.valid ? t('certificate.valid') : t('certificate.invalid')}
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">{t('certificate.number')}</dt>
                  <dd className="font-medium text-gray-900">{result.number}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t('certificate.learner')}</dt>
                  <dd className="font-medium text-gray-900">{result.learner ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t('certificate.course')}</dt>
                  <dd className="font-medium text-gray-900">{result.course ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t('certificate.issuedOn')}</dt>
                  <dd className="font-medium text-gray-900">{result.issued_on ?? '—'}</dd>
                </div>
                {result.mention && (
                  <div>
                    <dt className="text-gray-500">{t('certificate.mention')}</dt>
                    <dd className="font-medium text-gray-900">{result.mention}</dd>
                  </div>
                )}
                {!result.valid && result.revoked_reason && (
                  <div className="sm:col-span-2">
                    <dt className="text-gray-500">{t('certificate.reason')}</dt>
                    <dd className="font-medium text-gray-900">{result.revoked_reason}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
