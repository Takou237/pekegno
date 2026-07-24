import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '@/api/auth.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await authApi.forgotPassword({ email });
      // Le backend renvoie toujours 200 (message générique), qu'un compte
      // existe ou non, pour éviter l'énumération d'emails.
      setIsSubmitted(true);
    } catch (error) {
      setFormError(extractErrorMessage(error, 'Une erreur est survenue. Réessayez.'));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="flex flex-col gap-5">
        <Alert variant="success">
          Si un compte est associé à cette adresse email, vous recevrez un lien de
          réinitialisation dans quelques instants.
        </Alert>
        <Link to="/login" className="text-center text-sm font-medium text-brand-600 hover:underline">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {formError && <Alert variant="error">{formError}</Alert>}

      <Input
        label="Adresse email"
        type="email"
        name="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        placeholder="vous@pekegno.com"
      />

      <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
        Envoyer le lien de réinitialisation
      </Button>

      <Link to="/login" className="text-center text-sm font-medium text-brand-600 hover:underline">
        Retour à la connexion
      </Link>
    </form>
  );
}
