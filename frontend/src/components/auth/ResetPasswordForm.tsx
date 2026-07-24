import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/api/auth.api';
import { useToast } from '@/hooks/useToast';
import { extractErrorMessage } from '@/api/errors';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export function ResetPasswordForm() {
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
      setFormError('Les mots de passe ne correspondent pas.');
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
      showToast('Mot de passe réinitialisé avec succès. Vous pouvez vous reconnecter.', 'success');
      navigate('/login', { replace: true });
    } catch (error) {
      setFormError(
        extractErrorMessage(error, 'Ce lien de réinitialisation est invalide ou a expiré.')
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isLinkValid) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="error">
          Ce lien de réinitialisation est incomplet ou invalide. Merci de refaire une
          demande.
        </Alert>
        <Link
          to="/forgot-password"
          className="text-center text-sm font-medium text-brand-600 hover:underline"
        >
          Refaire une demande
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {formError && <Alert variant="error">{formError}</Alert>}

      <Input label="Adresse email" type="email" value={email} readOnly disabled />

      <Input
        label="Nouveau mot de passe"
        type="password"
        name="password"
        autoComplete="new-password"
        required
        hint="8 caractères minimum."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <Input
        label="Confirmer le mot de passe"
        type="password"
        name="password_confirmation"
        autoComplete="new-password"
        required
        value={passwordConfirmation}
        onChange={(e) => setPasswordConfirmation(e.target.value)}
      />

      <Button type="submit" isLoading={isSubmitting}>
        Réinitialiser le mot de passe
      </Button>
    </form>
  );
}
