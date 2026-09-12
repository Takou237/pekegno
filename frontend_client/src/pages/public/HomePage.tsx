import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { GraduationCap, Briefcase, Globe, ArrowRight } from 'lucide-react';
import { publicApi } from '@/api/public.api';

export default function HomePage() {
  const { t } = useTranslation();
  const [counts, setCounts] = useState({ services: 0, formations: 0, products: 0, countries: 0 });

  useEffect(() => {
    Promise.all([publicApi.getCountries(), publicApi.getServices(), publicApi.getProducts(), publicApi.getCourses()])
      .then(([countries, services, products, courses]) => {
        setCounts({
          countries: countries.length,
          services: services.length,
          formations: courses.length,
          products: products.length,
        });
      })
      .catch(() => {});
  }, []);

  const features = [
    { icon: GraduationCap, title: t('home.formations'), desc: t('home.formationDesc'), count: counts.formations, to: '/catalogue?type=formation' },
    { icon: Briefcase, title: t('home.services'), desc: t('home.serviceDesc'), count: counts.services + counts.products, to: '/catalogue?type=product' },
    { icon: Globe, title: t('home.countries'), desc: t('home.countryDesc'), count: counts.countries, to: '/catalogue' },
  ];

  return (
    <div>
      <section className="bg-gradient-to-br from-brand-600 to-brand-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('home.title')}</h1>
          <p className="text-lg text-brand-100 mb-8 max-w-2xl mx-auto">{t('home.subtitle')}</p>
          <Link to="/catalogue" className="inline-flex items-center gap-2 bg-white text-brand-600 px-6 py-3 rounded-lg font-semibold hover:bg-brand-50 transition-colors">
            {t('home.browseCatalog')} <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map(({ icon: Icon, title, desc, count, to }) => (
            <Link
              key={title}
              to={to}
              className="group bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-50 text-brand-600 mb-4">
                <Icon size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 mb-4">{desc}</p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-600">
                {count} {t('home.available')}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('home.title')}</h2>
          <p className="text-gray-500 mb-8 max-w-xl mx-auto">{t('home.cta')}</p>
          <Link to="/catalogue" className="inline-flex items-center gap-2 bg-brand-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-600 transition-colors">
            {t('home.browseCatalog')} <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}