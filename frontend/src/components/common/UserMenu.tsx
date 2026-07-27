import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, ShieldCheck, ShieldAlert, UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return null;
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || '—';

  async function handleLogout() {
    setIsOpen(false);
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
          {fullName.charAt(0).toUpperCase()}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-medium text-gray-800 dark:text-gray-100">
            {fullName}
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            {user.role?.name ?? 'Sans rôle'}
          </span>
        </span>
        {user.two_factor_enabled ? (
          <ShieldCheck className="h-4 w-4 text-success-500" aria-label="2FA activée" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-warning-500" aria-label="2FA non activée" />
        )}
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-gray-100 bg-white py-2 shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <Link
            to="/profile"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <UserRound className="h-4 w-4" />
            Mon profil
          </Link>
          {!user.two_factor_enabled && (
            <Link
              to="/profile#security"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-warning-600 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <ShieldAlert className="h-4 w-4" />
              Activer la 2FA
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-error-600 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}
