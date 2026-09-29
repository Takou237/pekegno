import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound } from 'lucide-react';
import { usersApi } from '@/api/users.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { UserListItem } from '@/types/user';

/**
 * Règle de l'API (T9) : super-admin et direction générale uniquement, jamais
 * sur soi-même, et la direction générale ne touche pas à un super-admin.
 */
export function canResetPasswordOf(
  currentUser: { id: string; role?: { name: string } | null } | null,
  user: Pick<UserListItem, 'id' | 'role'>,
): boolean {
  const role = currentUser?.role?.name ?? '';
  if (!['super-admin', 'direction-generale'].includes(role) || user.id === currentUser?.id) return false;
  return user.role?.name !== 'super-admin' || role === 'super-admin';
}

/** Bouton « réinitialiser le mot de passe » d'une ligne d'utilisateur, avec confirmation. */
export function ResetPasswordButton({ user }: { user: UserListItem }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!canResetPasswordOf(currentUser, user)) return null;

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await usersApi.resetPassword(user.id);
      showToast(t('users.passwordResetDone'), 'success');
      setOpen(false);
    } catch (err) {
      showToast(extractErrorMessage(err, t('users.passwordResetFailed')), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-amber-600 dark:hover:bg-gray-800"
        title={t('users.resetPassword')}
        aria-label={t('users.resetPassword')}
      >
        <KeyRound className="h-4 w-4" />
      </button>
      <ConfirmDialog
        isOpen={open}
        title={t('users.resetPasswordTitle')}
        message={t('users.resetPasswordMessage', { name: user.name ?? user.username })}
        confirmLabel={t('users.resetPasswordConfirm')}
        variant="danger"
        isLoading={submitting}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
