import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { extractErrorMessage } from '@/api/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register } = useAuth();
  const { showToast } = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== passwordConfirmation) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await register({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        city,
        country,
        password,
        password_confirmation: passwordConfirmation,
      });
      showToast(t('auth.registerSuccess'), 'success');
      navigate('/mon-compte');
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t('common.error')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold text-brand-600">PEKEGNO</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">{t('auth.registerTitle')}</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {error && <div className="mb-4"><Alert variant="error">{error}</Alert></div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('account.firstName')} type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" />
              <Input label={t('account.lastName')} type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" />
            </div>
            <Input label={t('auth.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('account.phone')} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
              <Input label={t('account.city')} type="text" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <Input label={t('account.country')} type="text" value={country} onChange={(e) => setCountry(e.target.value)} />
            <Input label={t('auth.password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
            <Input label={t('auth.passwordConfirm')} type="password" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} required autoComplete="new-password" />
            <Button type="submit" isLoading={loading} fullWidth>{t('auth.registerButton')}</Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            {t('auth.hasAccount')}{' '}
            <Link to="/connexion" className="text-brand-600 font-medium hover:text-brand-700">{t('auth.loginButton')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
