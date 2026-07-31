import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen w-full">
      {/* Colonne formulaire */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <span className="text-2xl font-semibold tracking-tight text-brand-600 dark:text-brand-400">
              PEKEGNO
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white sm:text-2xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
            )}
          </div>

          {children}
        </div>
      </div>

      {/* Colonne illustration (masquée en mobile) */}
      <div className="relative hidden w-1/2 items-center justify-center bg-brand-900 lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-800 via-brand-900 to-gray-900" />
        <div className="relative z-10 max-w-md px-10 text-center text-white">
          <h2 className="text-2xl font-semibold">{t('auth.brandTagline')}</h2>
          <p className="mt-4 text-brand-100">{t('auth.brandTaglineSub')}</p>
        </div>
      </div>
    </div>
  );
}
