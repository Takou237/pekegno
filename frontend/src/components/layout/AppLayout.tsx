import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { UserMenu } from '@/components/common/UserMenu';

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-gray-100 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
          <div className="mr-auto">
            <MobileNav />
          </div>
          <UserMenu />
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
