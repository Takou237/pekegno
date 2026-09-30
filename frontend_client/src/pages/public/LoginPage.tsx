import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { authApi } from '@/api/auth.api';
import { extractErrorMessage } from '@/api/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

const RESEND_COOLDOWN_SECONDS = 60;

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, verifyTwoFactor, cancelTwoFactorChallenge, pendingTwoFactorToken } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Étape 2FA
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);

  const redirect = searchParams.get('redirect') || '/mon-compte';

  // Le code email vient d'être envoyé au moment du login : le cooldown démarre
  // à l'affichage de l'écran de saisie.
  useEffect(() => {
    if (!pendingTwoFactorToken) {
      return;
    }

    setResendCooldown(RESEND_COOLDOWN_SECONDS);

    const timer = setInterval(() => {
      setResendCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingTwoFactorToken]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);

      if (result.requiresTwoFactor) {
        showToast(t('auth.twoFactorCodeSent'), 'info');
        return; // reste sur la page : l'écran de saisie du code s'affiche
      }

      showToast(t('auth.loginSuccess'), 'success');
      navigate(redirect);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDigitChange = (index: number, rawValue: string) => {
    const value = rawValue.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    if (value && index < 5) {
      document.getElementById(`client-2fa-digit-${index + 1}`)?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      document.getElementById(`client-2fa-digit-${index - 1}`)?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');

    if (code.length !== 6) {
      setError(t('auth.twoFactorError'));
      return;
    }

    setError('');
    setVerifying(true);
    try {
      await verifyTwoFactor(code);
      showToast(t('auth.loginSuccess'), 'success');
      navigate(redirect);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || t('auth.twoFactorInvalid'));
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!pendingTwoFactorToken || resendCooldown > 0 || resending) {
      return;
    }

    setError('');
    setResending(true);
    try {
      await authApi.resendTwoFactorEmailCode(pendingTwoFactorToken);
      showToast(t('auth.twoFactorCodeResent'), 'success');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t('auth.twoFactorResendError')));
    } finally {
      setResending(false);
    }
  };

  const handleBackToLogin = () => {
    cancelTwoFactorChallenge();
    setDigits(Array(6).fill(''));
    setError('');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold text-brand-600">PEKEGNO</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">
            {pendingTwoFactorToken ? t('auth.twoFactorTitle') : t('auth.loginTitle')}
          </h1>
          {pendingTwoFactorToken && (
            <p className="text-sm text-gray-500 mt-2">{t('auth.twoFactorSubtitle')}</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          {error && <div className="mb-4"><Alert variant="error">{error}</Alert></div>}

          {pendingTwoFactorToken ? (
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="flex justify-between gap-2">
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    id={`client-2fa-digit-${index}`}
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(index, e)}
                    className="h-14 w-12 rounded-lg border border-gray-300 text-center text-lg font-semibold text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                ))}
              </div>

              <Button type="submit" isLoading={verifying} fullWidth>
                {t('auth.twoFactorVerifyButton')}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || resending}
                  className="font-medium text-brand-600 hover:text-brand-700 disabled:cursor-not-allowed disabled:text-gray-400"
                >
                  {resendCooldown > 0
                    ? t('auth.twoFactorResendIn', { seconds: resendCooldown })
                    : t('auth.twoFactorResend')}
                </button>
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {t('auth.backToLogin')}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input label={t('auth.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              <Input label={t('auth.password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />

              <div className="text-right">
                <Link to="/mot-de-passe-oublie" className="text-sm text-brand-600 hover:text-brand-700">{t('auth.forgotPassword')}</Link>
              </div>

              <Button type="submit" isLoading={loading} fullWidth>{t('auth.loginButton')}</Button>

              <p className="text-center text-sm text-gray-500">
                {t('auth.noAccount')}{' '}
                <Link to="/inscription" className="text-brand-600 font-medium hover:text-brand-700">{t('auth.registerButton')}</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
