import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { publicApi } from '@/api/public.api';
import { formatCurrency, displayPrice } from '@/utils';
import { PackageCard, groupPackagesByCategory } from '@/components/catalog/PackageCard';
import { OfferSubscribeModal } from '@/components/packages/OfferSubscribeModal';
import { SkeletonCards } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Search, SlidersHorizontal, ShoppingCart, GraduationCap, MapPin, Tag, UserPlus } from 'lucide-react';
import type { Country, Agency, Service, Product, PublicCourse, PublicPackage, PublicOffer } from '@/types';

type CatalogItem =
  | (Service & { type: 'service' })
  | (Product & { type: 'product' })
  | (PublicCourse & { type: 'course' });

const PER_PAGE_OPTIONS = [8, 12, 24];

interface CatalogSectionProps {
  title?: string;
}

export default function CatalogSection({ title }: CatalogSectionProps) {
  const { t } = useTranslation();
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const typeParam = searchParams.get('type') ?? 'all';
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [packages, setPackages] = useState<PublicPackage[]>([]);
  const [offers, setOffers] = useState<PublicOffer[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedAgency, setSelectedAgency] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(8);
  const [subscribeOffer, setSubscribeOffer] = useState<PublicOffer | null>(null);

  const types = [
    { key: 'all', label: t('catalog.typeAll') },
    { key: 'formation', label: t('catalog.typeFormations') },
    { key: 'product', label: t('catalog.typeProducts') },
    { key: 'package', label: t('catalog.typePackages') },
  ];

  const setType = (key: string) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'all') next.delete('type');
    else next.set('type', key);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    publicApi.getCountries().then(setCountries).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (selectedCountry) params.country_id = selectedCountry;
    if (selectedAgency) params.agency_id = selectedAgency;

    Promise.all([
      publicApi.getServices(params).then((services) => services.map((s) => ({ ...s, type: 'service' as const }))),
      publicApi.getProducts(params).then((products) => products.map((p) => ({ ...p, type: 'product' as const }))),
      publicApi.getCourses(params).then((courses) => courses.map((c) => ({ ...c, type: 'course' as const }))),
      publicApi.getPackages(params).then((pkgs) => setPackages(pkgs)),
      publicApi.getOffers(params).then(setOffers).catch(() => setOffers([])),
    ])
      .then(([services, products, courses]) => setItems([...services, ...products, ...courses]))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [selectedCountry, selectedAgency]);

  useEffect(() => {
    if (selectedCountry) {
      publicApi.getAgencies({ country_id: selectedCountry }).then(setAgencies).catch(() => {});
    } else {
      setAgencies([]);
    }
  }, [selectedCountry]);

  const filtered = items.filter((item) => {
    if (typeParam === 'package') return false;
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (typeParam === 'formation') return item.type === 'course';
    if (typeParam === 'product') return item.type === 'product' || item.type === 'service';
    return true;
  });

  const filteredPackages =
    typeParam === 'package'
      ? packages.filter((pkg) => {
          if (!search) return true;
          const q = search.toLowerCase();
          return (
            pkg.name.toLowerCase().includes(q) ||
            (pkg.tagline ?? '').toLowerCase().includes(q) ||
            (pkg.description ?? '').toLowerCase().includes(q)
          );
        })
      : [];

  const filteredOffers =
    typeParam === 'package'
      ? offers.filter((offer) => {
          if (!search) return true;
          const q = search.toLowerCase();
          return (
            offer.name.toLowerCase().includes(q) ||
            (offer.description ?? '').toLowerCase().includes(q)
          );
        })
      : [];

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  useEffect(() => {
    setPage(1);
  }, [search, typeParam, selectedCountry, selectedAgency]);

  const handleQuickAdd = (item: CatalogItem) => {
    if (item.type === 'course') return;
    addItem({
      type: item.type,
      id: item.id,
      name: item.name,
      unitPrice: displayPrice(item),
      quantity: 1,
      slug: item.slug,
      coverImage: item.cover_image,
      agencyId: item.agency ? item.agency.id : undefined,
      agencyName: item.agency ? item.agency.name : undefined,
      categoryName: item.category ? item.category.name : undefined,
    });
    showToast(t('cart.added'), 'success');
  };

  const goToPage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Souscription à une prestation — même logique que l'inscription à une
  // formation : sans connexion → /connexion, sinon modale puis suivi depuis
  // « Mes prestations ».
  const handleOfferSubscribe = (offer: PublicOffer) => {
    if (!isAuthenticated) {
      showToast(t('offers.loginToSubscribe'), 'info');
      navigate('/connexion');
      return;
    }
    setSubscribeOffer(offer);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {title && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={t('common.search') + '...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm w-full md:w-64 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {types.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setType(key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              typeParam === key ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-gray-400" />
          <select value={selectedCountry} onChange={(e) => setSelectedCountry(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">{t('catalog.all')} {t('catalog.country')}</option>
            {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {agencies.length > 0 && (
          <select value={selectedAgency} onChange={(e) => setSelectedAgency(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">{t('catalog.all')} {t('catalog.agency')}</option>
            {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <SkeletonCards />
      ) : typeParam === 'package' ? (
        filteredPackages.length === 0 && filteredOffers.length === 0 ? (
          <div className="text-center py-16 text-gray-500">{t('catalog.noResults')}</div>
        ) : (
          <>
            {filteredPackages.length > 0 && (
              <p className="text-sm text-gray-600 mb-4">
                {t('catalog.showing', { from: 1, to: filteredPackages.length, total: filteredPackages.length })}
              </p>
            )}
            <div className="flex flex-col gap-6">
              {groupPackagesByCategory(filteredPackages, t('packages.uncategorized')).map((group) => (
                <section key={group.name} className="flex flex-col gap-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    <Tag className="h-4 w-4" /> {group.name}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {group.items.map((pkg) => (
                      <PackageCard
                        key={pkg.id}
                        pkg={pkg}
                        showAgency={!selectedAgency}
                        onOpen={(p) => navigate(`/packages/${p.id}`)}
                        onSubscribe={(p) => navigate(`/packages/${p.id}?subscribe=1`)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <section className="flex flex-col gap-3 mt-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                <Tag className="h-4 w-4" /> {t('catalog.offers')}
              </h2>
              {filteredOffers.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">{t('catalog.noOffers')}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow group flex flex-col"
                    >
                      <div className="h-48 bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center">
                        <span className="text-4xl font-bold text-brand-200">{offer.name[0]}</span>
                      </div>
                      <div className="p-5 flex flex-col flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                            {t('catalog.offers')}
                          </span>
                          {offer.category && <span className="text-xs text-gray-400">{offer.category.name}</span>}
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-brand-600 transition-colors">
                          {offer.name}
                        </h3>
                        {offer.description && (
                          <p className="text-sm text-gray-500 line-clamp-2 mb-3 flex-1">{offer.description}</p>
                        )}
                        {offer.agency && (
                          <p className="flex items-center gap-1 text-xs text-gray-400 mb-4">
                            <MapPin size={12} />
                            {offer.agency.name}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOfferSubscribe(offer)}
                          className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                        >
                          <UserPlus size={16} />
                          {t('offers.subscribe')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">{t('catalog.noResults')}</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="text-sm text-gray-600">
              {t('catalog.showing', { from: start + 1, to: start + pageItems.length, total: filtered.length })}
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>{t('catalog.perPage')}</span>
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                {PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pageItems.map((item) => (
              <Link
                key={item.id}
                to={`/produits/${item.slug ?? item.id}`}
                className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
              >
                {item.cover_image ? (
                  <div className="h-48 bg-gray-100 overflow-hidden">
                    <img src={item.cover_image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ) : (
                  <div className="h-48 bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center">
                    <span className="text-4xl font-bold text-brand-200">{item.name[0]}</span>
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                      {item.type === 'service' ? t('catalog.typeServices') : item.type === 'course' ? t('catalog.typeFormations') : t('catalog.typeProducts')}
                    </span>
                    {item.type === 'course'
                      ? item.categories[0] && <span className="text-xs text-gray-400">{item.categories[0].name}</span>
                      : item.category && <span className="text-xs text-gray-400">{item.category.name}</span>}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-brand-600 transition-colors">{item.name}</h3>
                  {item.type === 'course' && item.available_at && item.available_at.length > 1 && (
                    <p className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                      <MapPin size={12} />
                      {t('catalog.availableAt', { count: item.available_at.length })}
                    </p>
                  )}
                  {item.description && <p className="text-sm text-gray-500 line-clamp-2 mb-3">{item.description}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-brand-600">{formatCurrency(displayPrice(item))}</span>
                    {item.type === 'course' ? (
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-brand-50 text-brand-600">
                        <GraduationCap size={18} />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleQuickAdd(item);
                        }}
                        aria-label={t('cart.addToCart')}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-600 hover:text-white transition-colors"
                      >
                        <ShoppingCart size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-8">
            <Pagination page={safePage} totalPages={totalPages} onChange={goToPage} />
          </div>
        </>
      )}

      {subscribeOffer && (
        <OfferSubscribeModal
          offer={subscribeOffer}
          onClose={() => setSubscribeOffer(null)}
          onDone={() => {
            setSubscribeOffer(null);
            navigate('/mon-compte/prestations');
          }}
        />
      )}
    </div>
  );
}