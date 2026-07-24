import { useState, type FormEvent } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { authApi } from '@/api/auth.api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { extractErrorMessage } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import type { TwoFactorEnableResponse } from '@/types/auth';

export function TwoFactorSettings() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  // --- Activation (F6) ---
  const [setupData, setSetupData] = useState<TwoFactorEnableResponse | null>(null);
  const [isEnabling, setIsEnabling] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // --- Désactivation (F7) ---
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [isDisabling, setIsDisabling] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  async function handleStartSetup() {
    setSetupError(null);
    setIsEnabling(true);
    try {
      const data = await authApi.enableTwoFactor();
      setSetupData(data);
    } catch (error) {
      setSetupError(extractErrorMessage(error, "Impossible d'activer la 2FA pour le moment."));
    } finally {
      setIsEnabling(false);
    }
  }

  async function handleVerifySetup(event: FormEvent) {
    event.preventDefault();
    setSetupError(null);
    setIsVerifying(true);
    try {
      await authApi.verifyTwoFactorSetup(verifyCode);
      showToast('Double authentification activée avec succès.', 'success');
      setSetupData(null);
      setVerifyCode('');
      await refreshUser();
    } catch (error) {
      setSetupError(extractErrorMessage(error, 'Code invalide.'));
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleDisable(event: FormEvent) {
    event.preventDefault();
    setDisableError(null);
    setIsDisabling(true);
    try {
      await authApi.disableTwoFactor(disablePassword, disableCode);
      showToast('Double authentification désactivée.', 'success');
      setIsDisableModalOpen(false);
      setDisablePassword('');
      setDisableCode('');
      await refreshUser();
    } catch (error) {
      setDisableError(extractErrorMessage(error, 'Mot de passe ou code invalide.'));
    } finally {
      setIsDisabling(false);
    }
  }

  return (
    <div id="security" className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-4 dark:border-gray-800">
        {user.two_factor_enabled ? (
          <ShieldCheck className="h-8 w-8 text-success-500" />
        ) : (
          <ShieldAlert className="h-8 w-8 text-warning-500" />
        )}
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
            Double authentification (2FA){' '}
            {user.two_factor_enabled ? (
              <span className="text-success-600">activée</span>
            ) : (
              <span className="text-warning-600">non activée</span>
            )}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ajoute une étape de vérification par code à 6 chiffres lors de la connexion.
          </p>
        </div>
        <div className="w-48 shrink-0">
          {user.two_factor_enabled ? (
            <Button variant="outline" onClick={() => setIsDisableModalOpen(true)}>
              Désactiver
            </Button>
          ) : (
            <Button onClick={handleStartSetup} isLoading={isEnabling}>
              Activer
            </Button>
          )}
        </div>
      </div>

      {/* Étape de setup : QR code + confirmation du code (F6) */}
      {setupData && (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-100 p-4 dark:border-gray-800">
          {setupError && <Alert variant="error">{setupError}</Alert>}
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Scannez ce QR code avec votre application d'authentification (Google
            Authenticator, Authy...), ou saisissez le secret manuellement.
          </p>
          <img
            src={setupData.qr_code_url}
            alt="QR code de configuration 2FA"
            className="h-40 w-40 rounded-lg border border-gray-100 dark:border-gray-800"
          />
          <p className="break-all rounded bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {setupData.secret}
          </p>
          <form onSubmit={handleVerifySetup} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="Code de vérification"
                inputMode="numeric"
                maxLength={6}
                required
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
              />
            </div>
            <div className="w-full sm:w-48">
              <Button type="submit" isLoading={isVerifying}>
                Confirmer l'activation
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de désactivation (F7) */}
      <Modal
        isOpen={isDisableModalOpen}
        onClose={() => setIsDisableModalOpen(false)}
        title="Désactiver la double authentification"
      >
        <form onSubmit={handleDisable} className="flex flex-col gap-4">
          {disableError && <Alert variant="error">{disableError}</Alert>}
          <Input
            label="Mot de passe actuel"
            type="password"
            required
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
          />
          <Input
            label="Code 2FA actuel"
            inputMode="numeric"
            maxLength={6}
            required
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
          />
          <Button type="submit" isLoading={isDisabling} className="!bg-error-500 hover:!bg-error-600">
            Désactiver la 2FA
          </Button>
        </form>
      </Modal>
    </div>
  );
}
