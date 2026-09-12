import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { authApi } from '@/api/auth.api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSuccess(true);
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold text-brand-600">PEKEGNO</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">{t('auth.forgotTitle')}</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {success ? (
            <Alert variant="success">{t('auth.forgotSuccess')}</Alert>
          ) : (
            <>
              {error && <div className="mb-4"><Alert variant="error">{error}</Alert></div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label={t('auth.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                <Button type="submit" isLoading={loading} fullWidth>{t('auth.forgotButton')}</Button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            <Link to="/connexion" className="text-brand-600 font-medium hover:text-brand-700">{t('auth.backToLogin')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
