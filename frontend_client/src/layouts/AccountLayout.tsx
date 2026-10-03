import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { LayoutDashboard, ShoppingCart, FileText, GraduationCap, BookOpen, UserCircle, LogOut, Menu, X, Globe, Store, Briefcase, Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { agencyApi } from '@/api/agency.api';
import { applyLanguage, detectInitialLanguage } from '@/i18n';

const navItems = [
  { to: '/mon-compte', icon: LayoutDashboard, labelKey: 'account.dashboard', exact: true },
  { to: '/mon-compte/commandes', icon: ShoppingCart, labelKey: 'account.orders' },
  { to: '/mon-compte/factures', icon: FileText, labelKey: 'account.invoices' },
  { to: '/mon-compte/formations', icon: GraduationCap, labelKey: 'account.formations' },
  { to: '/mon-compte/fiche-apprenant', icon: BookOpen, labelKey: 'account.learner' },
  { to: '/mon-compte/prestations', icon: Briefcase, labelKey: 'agency.myPrestations' },
  { to: '/mon-compte/notifications', icon: Bell, labelKey: 'agency.notifications' },
  { to: '/mon-compte/profil', icon: UserCircle, labelKey: 'account.profile' },
];

export default function AccountLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const lang = detectInitialLanguage();
  const [unread, setUnread] = useState(0);

  // Pastille de notifications non lues (rappels de renouvellement Agency).
  useEffect(() => {
    agencyApi.notifications().then((r) => setUnread(r.unread_count)).catch(() => {});
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="hidden lg:flex lg:w-64 bg-white border-r border-gray-200 flex-col">
        <div className="px-6 py-5 border-b border-gray-200">
          <Link to="/" className="text-lg font-bold text-brand-600">PEKEGNO</Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, labelKey, exact }) => {
            const active = exact ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <Link key={to} to={to} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                <Icon size={18} />
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-gray-200 space-y-2">
          <div className="flex items-center gap-2 px-3 text-sm text-gray-500">
            <UserCircle size={18} />
            <span className="truncate">{user?.name}</span>
          </div>
          <button onClick={logout} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-error-600">
            <LogOut size={18} />
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={`fixed lg:hidden inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-brand-600" onClick={() => setMobileOpen(false)}>PEKEGNO</Link>
          <button onClick={() => setMobileOpen(false)}><X size={20} /></button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, labelKey, exact }) => {
            const active = exact ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <Link key={to} to={to} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                <Icon size={18} />
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-gray-200">
          <button onClick={() => { logout(); setMobileOpen(false); }} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-error-600">
            <LogOut size={18} /> {t('nav.logout')}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center px-4 lg:px-8 gap-4">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden text-gray-600">
            <Menu size={24} />
          </button>
          <div className="flex-1" />
          <Link to="/mon-compte/notifications" className="relative text-gray-500 hover:text-brand-600" aria-label={t('agency.notifications')}>
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-error-500 px-1 text-center text-[10px] font-semibold leading-4 text-white">{unread}</span>
            )}
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
            <Store size={16} /> {t('account.backToCatalog')}
          </Link>
          <div className="relative">
            <button onClick={() => applyLanguage(lang === 'fr' ? 'en' : 'fr')} className="flex items-center gap-1 text-sm text-gray-500">
              <Globe size={16} /> {lang.toUpperCase()}
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
