import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';

interface ComingSoonPageProps {
  title?: string;
}

export default function ComingSoonPage({ title }: ComingSoonPageProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-500/10">
        <Construction className="h-8 w-8 text-brand-500" />
      </div>
      <h2 className="mt-6 text-lg font-semibold text-gray-900 dark:text-white">
        {title ?? t('common.comingSoon')}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        {t('common.comingSoonDesc')}
      </p>
    </div>
  );
}
