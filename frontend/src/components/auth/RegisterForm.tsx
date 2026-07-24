import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { RegisterPayload } from '@/types/auth';

const initialForm: RegisterPayload = {
  username: '',
  email: '',
  password: '',
  password_confirmation: '',
  first_name: '',
  last_name: '',
  phone: '',
};

export function RegisterForm() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState<RegisterPayload>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function update<K extends keyof RegisterPayload>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await register(form);
      showToast('Compte créé avec succès. Vous pouvez maintenant vous connecter.', 'success');
      navigate('/login', { replace: true });
    } catch (error) {
      setFormError(extractErrorMessage(error, "Inscription impossible. Réessayez."));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {formError && <Alert variant="error">{formError}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Prénom"
          name="first_name"
          value={form.first_name}
          onChange={(e) => update('first_name', e.target.value)}
          error={fieldErrors.first_name}
        />
        <Input
          label="Nom"
          name="last_name"
          value={form.last_name}
          onChange={(e) => update('last_name', e.target.value)}
          error={fieldErrors.last_name}
        />
      </div>

      <Input
        label="Nom d'utilisateur"
        name="username"
        required
        value={form.username}
        onChange={(e) => update('username', e.target.value)}
        error={fieldErrors.username}
      />

      <Input
        label="Adresse email"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={form.email}
        onChange={(e) => update('email', e.target.value)}
        error={fieldErrors.email}
      />

      <Input
        label="Téléphone"
        name="phone"
        value={form.phone}
        onChange={(e) => update('phone', e.target.value)}
        error={fieldErrors.phone}
      />

      <Input
        label="Mot de passe"
        type="password"
        name="password"
        autoComplete="new-password"
        required
        hint="8 caractères minimum."
        value={form.password}
        onChange={(e) => update('password', e.target.value)}
        error={fieldErrors.password}
      />

      <Input
        label="Confirmer le mot de passe"
        type="password"
        name="password_confirmation"
        autoComplete="new-password"
        required
        value={form.password_confirmation}
        onChange={(e) => update('password_confirmation', e.target.value)}
      />

      <Button type="submit" isLoading={isSubmitting}>
        Créer mon compte
      </Button>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Déjà inscrit ?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
