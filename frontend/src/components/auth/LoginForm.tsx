import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export function LoginForm() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const result = await login({ email, password });
      navigate(result.requiresTwoFactor ? '/two-factor' : '/', { replace: true });
    } catch (error) {
      setFormError(extractErrorMessage(error, t('auth.loginFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {formError && <Alert variant="error">{formError}</Alert>}

      <Input
        label={t('auth.email')}
        type="email"
        name="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        placeholder={t('auth.emailPlaceholder')}
      />

      <Input
        label={t('auth.password')}
        type="password"
        name="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        placeholder="••••••••"
      />

      <div className="flex justify-end -mt-2">
        <Link
          to="/forgot-password"
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          {t('auth.forgotPassword')}
        </Link>
      </div>

      <Button type="submit" isLoading={isSubmitting}>
        {t('auth.signIn')}
      </Button>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:underline">
          {t('auth.createAccount')}
        </Link>
      </p>
    </form>
  );
}
