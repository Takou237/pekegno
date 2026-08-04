import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/api/auth.api';
import { useToast } from '@/hooks/useToast';
import { extractErrorMessage } from '@/api/errors';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export function ResetPasswordForm() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isLinkValid = Boolean(token && email);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (password !== passwordConfirmation) {
      setFormError(t('auth.passwordMismatch'));
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.resetPassword({
        token,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });
      showToast(t('auth.resetSuccess'), 'success');
      navigate('/login', { replace: true });
    } catch (error) {
      setFormError(extractErrorMessage(error, t('auth.resetLinkInvalid')));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isLinkValid) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="error">{t('auth.resetLinkIncomplete')}</Alert>
        <Link
          to="/forgot-password"
          className="text-center text-sm font-medium text-brand-600 hover:underline"
        >
          {t('common.resetRequest')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {formError && <Alert variant="error">{formError}</Alert>}

      <Input label={t('auth.email')} type="email" value={email} readOnly disabled />

      <Input
        label={t('auth.newPassword')}
        type="password"
        name="password"
        autoComplete="new-password"
        required
        hint={t('auth.passwordHint')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <Input
        label={t('auth.confirmNewPassword')}
        type="password"
        name="password_confirmation"
        autoComplete="new-password"
        required
        value={passwordConfirmation}
        onChange={(e) => setPasswordConfirmation(e.target.value)}
      />

      <Button type="submit" isLoading={isSubmitting} fullWidth>
        {t('auth.resetPassword')}
      </Button>
    </form>
  );
}
