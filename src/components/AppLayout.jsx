import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { BarChart3, Bell, ChevronLeft, ChevronRight, CircleDollarSign, Ellipsis, LayoutDashboard, LogOut, PiggyBank, ReceiptText, Scale, Settings, ShieldCheck, Target, Wallet, WifiOff, ArrowLeftRight, Folder } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import NotificationsDropdown from './NotificationsDropdown';
import ProfileDropdown from './ProfileDropdown';

const navSections = [
  { label: null, items: [['/', 'Dashboard', LayoutDashboard]] },
  { label: 'Money', items: [
    ['/transactions', 'Transactions', ReceiptText],
    ['/accounts', 'Accounts', Wallet],
    ['/transfers', 'Transfers', ArrowLeftRight],
  ]},
  { label: 'Planning', items: [
    ['/budgets', 'Budgets', PiggyBank],
    ['/goals', 'Goals', Target],
  ]},
  { label: 'Wealth', items: [
    ['/net-worth', 'Net Worth', Scale],
  ]},
  { label: 'Insights', items: [
    ['/reports', 'Reports', BarChart3],
  ]},
  { label: 'Manage', items: [
    ['/categories', 'Categories', Folder],
    ['/notifications', 'Notifications', Bell],
    ['/settings', 'Settings', Settings],
  ]},
];

const nav = navSections.flatMap((s) => s.items);

// Keep the mobile tab bar to the essentials; the rest lives in a "More" sheet.
const mobileNav = [['/', 'Dashboard', LayoutDashboard], ['/transactions', 'Transactions', ReceiptText], ['/accounts', 'Accounts', Wallet], ['/reports', 'Reports', BarChart3]];
const moreNav = nav.filter((n) => !mobileNav.some((m) => m[0] === n[0]));

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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

  // Close the More sheet when navigating
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  async function logout() {
    await signOut();
    clear();
    navigate('/login');
  }

  // Get active page name for mobile header
  const getPageTitle = () => {
    const match = nav.find(([path]) => path !== '/' && location.pathname.startsWith(path));
    if (match) return match[1];
    if (location.pathname.startsWith('/admin')) return 'Admin';
    return 'Monetra';
  };

  const linkClass = ({ isActive }) =>
    `group relative flex items-center ${collapsed ? 'justify-center' : 'gap-3'} rounded-xl ${collapsed ? 'p-2.5' : 'px-3 py-2.5'} text-sm font-medium transition ${isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-100'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
    }`;

  const tooltip = (label) => (
    <div className="pointer-events-none absolute left-full ml-4 w-max rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 dark:bg-slate-800 z-50">
      {label}
    </div>
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className={`flex h-20 items-center ${collapsed ? 'justify-center' : 'gap-3 px-5'}`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-700 text-white">
          <CircleDollarSign size={22} />
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-xl font-black tracking-tight truncate">Monetra</p>
            <p className="text-xs text-slate-500 truncate">Personal Finance</p>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {navSections.map((section, si) => (
          <div key={si} className={section.label ? 'pt-4 first:pt-0' : ''}>
            {section.label && !collapsed && (
              <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">{section.label}</p>
            )}
            {section.label && collapsed && si > 0 && (
              <div className="mx-auto my-2 h-px w-6 bg-slate-200 dark:bg-slate-700" />
            )}
            {section.items.map(([to, label, Icon]) => (
              <NavLink key={to} to={to} end={to === '/'} className={linkClass}>
                <Icon size={19} className="shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
                {collapsed && tooltip(label)}
                {label === 'Notifications' && hasUnread && (
                  <span className={`rounded-full bg-red-500 ${collapsed ? 'absolute top-2 right-2 h-2.5 w-2.5 ring-2 ring-white dark:ring-slate-900' : 'ml-auto h-2 w-2'}`} />
                )}
              </NavLink>
            ))}
          </div>
        ))}
        {isAdmin && (
          <NavLink to="/admin" className={linkClass}>
            <ShieldCheck size={19} className="shrink-0" />
            {!collapsed && <span>Admin</span>}
            {collapsed && tooltip('Admin')}
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
          {collapsed && tooltip('Sign out')}
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
          {mobileNav.map(([to, label, Icon]) => {
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
              </NavLink>
            );
          })}

          {/* More */}
          <button
            className="relative flex flex-1 flex-col items-center justify-center text-slate-500 dark:text-slate-400"
            onClick={() => setMoreOpen(!moreOpen)}
          >
            <div className={`flex flex-col items-center justify-center gap-0.5 transition ${moreOpen ? 'text-brand-700 dark:text-brand-400 scale-105' : 'hover:text-slate-700 dark:hover:text-slate-200'}`}>
              <Ellipsis size={20} />
              <span className="text-[10px] font-semibold">More</span>
            </div>
          </button>

          {/* More sheet */}
          {moreOpen && (
            <div className="absolute bottom-16 left-3 right-3 z-50 rounded-2xl border bg-white p-3 shadow-2xl animate-fade-in dark:bg-slate-900 dark:border-slate-700">
              <div className="grid grid-cols-3 gap-1">
                {moreNav.map(([to, label, Icon]) => {
                  const isActive = location.pathname.startsWith(to);
                  return (
                    <button
                      key={to}
                      onClick={() => navigate(to)}
                      className={`relative flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs font-semibold transition ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                    >
                      <Icon size={20} />
                      {label}
                      {label === 'Notifications' && hasUnread && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />}
                    </button>
                  );
                })}
                {isAdmin && (
                  <button
                    onClick={() => navigate('/admin')}
                    className={`flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs font-semibold transition ${location.pathname.startsWith('/admin') ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                  >
                    <ShieldCheck size={20} />
                    Admin
                  </button>
                )}
              </div>
            </div>
          )}
        </nav>
      </div>
    </div>
  );
}
