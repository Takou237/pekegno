import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/Input';
import { UserCircle, Mail } from 'lucide-react';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('account.profile')}</h1>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4 max-w-lg">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
            <UserCircle size={28} />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user?.name}</p>
            <p className="text-sm text-gray-500">Client</p>
          </div>
        </div>

        <Input label={t('auth.name')} value={user?.name ?? ''} disabled />
        <Input label={t('auth.email')} type="email" value={user?.email ?? ''} disabled />

        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500 flex items-center gap-2">
          <Mail size={16} className="text-gray-400" />
          {user?.email}
        </div>
      </div>
    </div>
  );
}
