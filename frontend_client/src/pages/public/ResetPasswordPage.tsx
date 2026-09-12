import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '@/api/auth.api';
import { extractErrorMessage } from '@/api/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';
  const hasParams = Boolean(token && email);

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== passwordConfirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({ token, email, password, password_confirmation: passwordConfirm });
      setSuccess(true);
    } catch (err) {
      setError(extractErrorMessage(err, t('auth.resetError')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold text-brand-600">PEKEGNO</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">{t('auth.resetTitle')}</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {success ? (
            <>
              <Alert variant="success">{t('auth.resetSuccess')}</Alert>
              <Link to="/connexion" className="mt-4 block text-center text-brand-600 font-medium hover:text-brand-700">
                {t('auth.loginButton')}
              </Link>
            </>
          ) : !hasParams ? (
            <>
              <Alert variant="error">{t('auth.resetLinkIncomplete')}</Alert>
              <p className="mt-4 text-center text-sm text-gray-500">
                <Link to="/mot-de-passe-oublie" className="text-brand-600 font-medium hover:text-brand-700">
                  {t('auth.forgotPassword')}
                </Link>
              </p>
            </>
          ) : (
            <>
              {error && <div className="mb-4"><Alert variant="error">{error}</Alert></div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label={t('auth.email')} type="email" value={email} disabled autoComplete="email" />
                <Input label={t('auth.newPassword')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
                <Input label={t('auth.passwordConfirm')} type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required autoComplete="new-password" />
                <Button type="submit" isLoading={loading} fullWidth>{t('auth.resetButton')}</Button>
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