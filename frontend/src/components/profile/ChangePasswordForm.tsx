import { useState, type FormEvent } from 'react';
import { authApi } from '@/api/auth.api';
import { useToast } from '@/hooks/useToast';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

const initialState = { current_password: '', password: '', password_confirmation: '' };

export function ChangePasswordForm() {
  const { showToast } = useToast();
  const [form, setForm] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function update(field: keyof typeof initialState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await authApi.changePassword(form);
      showToast(
        'Mot de passe changé avec succès. Vos autres sessions ont été déconnectées.',
        'success'
      );
      setForm(initialState);
    } catch (error) {
      setFormError(extractErrorMessage(error, 'Impossible de changer le mot de passe.'));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {formError && <Alert variant="error">{formError}</Alert>}

      <Input
        label="Mot de passe actuel"
        type="password"
        autoComplete="current-password"
        required
        value={form.current_password}
        onChange={(e) => update('current_password', e.target.value)}
        error={fieldErrors.current_password}
      />
      <Input
        label="Nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        required
        hint="8 caractères minimum."
        value={form.password}
        onChange={(e) => update('password', e.target.value)}
        error={fieldErrors.password}
      />
      <Input
        label="Confirmer le nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        required
        value={form.password_confirmation}
        onChange={(e) => update('password_confirmation', e.target.value)}
      />

      <div className="w-full sm:w-56">
        <Button type="submit" isLoading={isSubmitting}>
          Mettre à jour
        </Button>
      </div>
    </form>
  );
}
