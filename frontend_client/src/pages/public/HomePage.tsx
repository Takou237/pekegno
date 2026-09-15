import { useTranslation } from 'react-i18next';
import CatalogSection from '@/components/catalog/CatalogSection';

export default function HomePage() {
  const { t } = useTranslation();

  return (
    <div>
      <section className="bg-gradient-to-br from-brand-600 to-brand-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('home.title')}</h1>
          <p className="text-lg text-brand-100 max-w-2xl mx-auto">{t('home.subtitle')}</p>
        </div>
      </section>

      <CatalogSection title={t('catalog.title')} />
    </div>
  );
}