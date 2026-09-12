import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { authApi } from '@/api/auth.api';
import { extractErrorMessage } from '@/api/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { UserCircle, Mail, Lock } from 'lucide-react';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    phone: user?.phone ?? '',
    city: user?.city ?? '',
    country: user?.country ?? '',
    address: user?.address ?? '',
  });
  const [saving, setSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);

  const setField = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      showToast(t('account.missingField'), 'error');
      return;
    }
    setSaving(true);
    try {
      await authApi.updateProfile(form);
      await refreshUser();
      showToast(t('account.profileUpdated'), 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, t('account.profileUpdateError')), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    try {
      await authApi.changePassword(passwordForm);
      setPasswordForm({ current_password: '', password: '', password_confirmation: '' });
      showToast(t('account.passwordChanged'), 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, t('account.passwordChangeError')), 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('account.profile')}</h1>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100 mb-6">
          <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
            <UserCircle size={28} />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user?.name}</p>
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <Mail size={14} className="text-gray-400" />
              {user?.email}
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="max-w-lg space-y-4">
          <h2 className="font-semibold text-gray-900">{t('account.profileDetails')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('account.firstName')} value={form.first_name} onChange={setField('first_name')} required />
            <Input label={t('account.lastName')} value={form.last_name} onChange={setField('last_name')} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('account.phone')} value={form.phone} onChange={setField('phone')} />
            <Input label={t('account.city')} value={form.city} onChange={setField('city')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('account.country')} value={form.country} onChange={setField('country')} />
            <Input label={t('account.address')} value={form.address} onChange={setField('address')} />
          </div>
          <Button type="submit" isLoading={saving}>{t('account.saveProfile')}</Button>
        </form>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <form onSubmit={handleChangePassword} className="max-w-lg space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Lock size={18} className="text-brand-600" />
            {t('account.changePassword')}
          </h2>
          <Input label={t('account.currentPassword')} type="password" value={passwordForm.current_password} onChange={(e) => setPasswordForm((p) => ({ ...p, current_password: e.target.value }))} required autoComplete="current-password" />
          <Input label={t('auth.newPassword')} type="password" value={passwordForm.password} onChange={(e) => setPasswordForm((p) => ({ ...p, password: e.target.value }))} required autoComplete="new-password" />
          <Input label={t('auth.passwordConfirm')} type="password" value={passwordForm.password_confirmation} onChange={(e) => setPasswordForm((p) => ({ ...p, password_confirmation: e.target.value }))} required autoComplete="new-password" />
          <Button type="submit" isLoading={savingPassword}>{t('account.changePassword')}</Button>
        </form>
      </div>
    </div>
  );
}