import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Menu, X, Globe, LogOut, User, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { applyLanguage, detectInitialLanguage } from '@/i18n';
import type { SupportedLanguage } from '@/i18n';

export default function PublicLayout() {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const { count } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const lang = detectInitialLanguage();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="text-xl font-bold text-brand-600">PEKEGNO</Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link to="/" className="text-sm font-medium text-gray-600 hover:text-brand-600">{t('nav.home')}</Link>
              <Link to="/catalogue" className="text-sm font-medium text-gray-600 hover:text-brand-600">{t('nav.catalog')}</Link>
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <div className="relative">
                <button onClick={() => setLangOpen(!langOpen)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                  <Globe size={16} /> {lang.toUpperCase()}
                </button>
                {langOpen && (
                  <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                    <button onClick={() => { applyLanguage('fr' as SupportedLanguage); setLangOpen(false); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Francais</button>
                    <button onClick={() => { applyLanguage('en' as SupportedLanguage); setLangOpen(false); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50">English</button>
                  </div>
                )}
              </div>
              <Link to="/panier" aria-label={t('nav.cart')} className="relative flex items-center text-gray-600 hover:text-brand-600 transition-colors">
                <ShoppingCart size={22} />
                {count > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-brand-600 text-white text-xs font-semibold">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <Link to="/mon-compte" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-brand-600">
                    <User size={16} /> {user?.name}
                  </Link>
                  <button onClick={logout} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-error-600">
                    <LogOut size={16} /> {t('nav.logout')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link to="/connexion" className="text-sm font-medium text-gray-600 hover:text-brand-600">{t('nav.login')}</Link>
                  <Link to="/inscription" className="inline-flex items-center px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600">{t('nav.register')}</Link>
                </div>
              )}
            </div>

            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-gray-600">
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-3">
            <Link to="/" className="block text-sm font-medium text-gray-700" onClick={() => setMobileOpen(false)}>{t('nav.home')}</Link>
            <Link to="/catalogue" className="block text-sm font-medium text-gray-700" onClick={() => setMobileOpen(false)}>{t('nav.catalog')}</Link>
            <Link to="/panier" className="flex items-center gap-2 text-sm font-medium text-gray-700" onClick={() => setMobileOpen(false)}>
              <ShoppingCart size={16} /> {t('nav.cart')}{count > 0 ? ` (${count})` : ''}
            </Link>
            {isAuthenticated ? (
              <>
                <Link to="/mon-compte" className="block text-sm font-medium text-gray-700" onClick={() => setMobileOpen(false)}>{t('nav.myAccount')}</Link>
                <button onClick={() => { logout(); setMobileOpen(false); }} className="block text-sm text-error-600">{t('nav.logout')}</button>
              </>
            ) : (
              <>
                <Link to="/connexion" className="block text-sm font-medium text-gray-700" onClick={() => setMobileOpen(false)}>{t('nav.login')}</Link>
                <Link to="/inscription" className="block text-sm font-medium text-brand-600" onClick={() => setMobileOpen(false)}>{t('nav.register')}</Link>
              </>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} PEKEGNO. {t('footer.rights')}.</p>
        </div>
      </footer>
    </div>
  );
}
