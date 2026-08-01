import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Bell, ChevronLeft, ChevronRight, CircleDollarSign, LayoutDashboard, LogOut, PiggyBank, ReceiptText, Settings, ShieldCheck, WifiOff } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import NotificationsDropdown from './NotificationsDropdown';
import ProfileDropdown from './ProfileDropdown';

const nav = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/transactions', 'Transactions', ReceiptText],
  ['/budgets', 'Budgets', PiggyBank],
  ['/notifications', 'Notifications', Bell],
  ['/settings', 'Settings', Settings]
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuthStore();
  const { fetchAll, processQueue, syncQueue, notifications, clear } = useDataStore();
  const isAdmin = user?.app_metadata?.is_staff || user?.app_metadata?.role === 'admin';
  const hasUnread = notifications.some((x) => !x.is_read);

  useEffect(() => {
    fetchAll().then(processQueue);
    const up = () => { setOnline(true); processQueue(); };
    const down = () => setOnline(false);
    addEventListener('online', up); addEventListener('offline', down);
    return () => { removeEventListener('online', up); removeEventListener('offline', down); };
  }, [fetchAll, processQueue]);

  async function logout() {
    await signOut();
    clear();
    navigate('/login');
  }

  // Get active page name for mobile header
  const getPageTitle = () => {
    if (location.pathname === '/') return 'Dashboard';
    const match = nav.find(([path]) => path !== '/' && location.pathname.startsWith(path));
    if (match) return match[1];
    if (location.pathname.startsWith('/admin')) return 'Admin';
    return 'Monetra';
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className={`flex h-20 items-center ${collapsed ? 'justify-center' : 'gap-3 px-5'}`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-700 text-white">
          <CircleDollarSign size={22} />
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-xl font-black tracking-tight truncate">Monetra</p>
            <p className="text-xs text-slate-500 truncate">Expense Manager</p>
          </div>
        )}
      </div>
      <nav className={`flex-1 space-y-1 ${collapsed ? 'px-3' : 'px-3'}`}>
        {nav.map(([to, label, Icon]) => (
          <NavLink
            key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `group relative flex items-center ${collapsed ? 'justify-center' : 'gap-3'} rounded-xl ${collapsed ? 'p-2.5' : 'px-3 py-2.5'} text-sm font-medium transition ${isActive
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-100'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`
            }
          >
            <Icon size={19} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
            {collapsed && (
              <div className="pointer-events-none absolute left-full ml-4 w-max rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 dark:bg-slate-800 z-50">
                {label}
              </div>
            )}
            {label === 'Notifications' && hasUnread && (
              <span className={`rounded-full bg-red-500 ${collapsed ? 'absolute top-2 right-2 h-2.5 w-2.5 ring-2 ring-white dark:ring-slate-900' : 'ml-auto h-2 w-2'}`} />
            )}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `group relative flex items-center ${collapsed ? 'justify-center' : 'gap-3'} rounded-xl ${collapsed ? 'p-2.5' : 'px-3 py-2.5'} text-sm font-medium transition ${isActive
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`
            }
          >
            <ShieldCheck size={19} className="shrink-0" />
            {!collapsed && <span>Admin</span>}
            {collapsed && (
              <div className="pointer-events-none absolute left-full ml-4 w-max rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 dark:bg-slate-800 z-50">
                Admin
              </div>
            )}
          </NavLink>
        )}
      </nav>
      <div className={`border-t p-3 ${collapsed ? 'flex flex-col items-center' : ''}`}>
        <button
          className={`btn-secondary group relative ${collapsed ? 'flex h-10 w-10 items-center justify-center rounded-xl p-0' : 'w-full'}`}
          onClick={logout}
        >
          <LogOut size={17} className="shrink-0" />
          {!collapsed && <span>Sign out</span>}
          {collapsed && (
            <div className="pointer-events-none absolute left-full ml-4 w-max rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 dark:bg-slate-800 z-50">
              Sign out
            </div>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen transition-[grid-template-columns] duration-300 lg:grid ${collapsed ? 'lg:grid-cols-[80px_1fr]' : 'lg:grid-cols-[220px_1fr]'}`}>
      {/* Sidebar for desktop */}
      <aside className="sticky top-0 hidden h-screen overflow-y-auto overflow-x-hidden border-r bg-white dark:bg-slate-900 lg:block">{sidebar}</aside>

      <div className="min-w-0 pb-20 lg:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white/90 px-4 backdrop-blur dark:bg-slate-900/90 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-700 text-white lg:hidden">
              <CircleDollarSign size={18} />
            </span>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 lg:hidden">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-500">
            {!online && (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                <WifiOff size={14} /> Offline
              </span>
            )}
            {online && syncQueue.length > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                {syncQueue.length} sync pending
              </span>
            )}
            <div className="mx-1 hidden h-5 w-px bg-slate-200 sm:block dark:bg-slate-700" />
            <NotificationsDropdown />
            <ProfileDropdown onSignOut={logout} />
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto max-w-screen-2xl p-4 lg:p-8 animate-fade-in">
          <Outlet />
        </main>

        {/* Bottom tab bar for mobile */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 border-t bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] dark:bg-slate-900/95 lg:hidden">
          {nav.map(([to, label, Icon]) => {
            const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className="relative flex flex-1 flex-col items-center justify-center text-slate-500 dark:text-slate-400"
              >
                <div className={`flex flex-col items-center justify-center gap-0.5 transition ${isActive ? 'text-brand-700 dark:text-brand-400 scale-105' : 'hover:text-slate-700 dark:hover:text-slate-200'}`}>
                  <Icon size={20} />
                  <span className="text-[10px] font-semibold">{label}</span>
                </div>
                {label === 'Notifications' && hasUnread && (
                  <span className="absolute right-[33%] top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
