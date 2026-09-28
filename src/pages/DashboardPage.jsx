import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, PiggyBank, Plus, Scale, Target, TrendingUp, Wallet } from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { format, isSameMonth, parseISO, startOfWeek, addDays } from 'date-fns';
import Modal from '../components/Modal';
import TransactionForm from '../components/TransactionForm';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import { money, prettyDate } from '../lib/utils';

/* ── Custom tooltip ── */
function ChartTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-white px-3 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      {label && <p className="mb-1 text-xs font-semibold text-slate-500">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="text-sm font-bold" style={{ color: p.color || p.fill }}>
          {p.name ? `${p.name}: ` : ''}{money(p.value, currency)}
        </p>
      ))}
    </div>
  );
}

function FormattedMoney({ value, currency }) {
  const str = money(value, currency);
  const match = str.match(/^(.*)(\.\d{2})$/);
  if (match) {
    return <>{match[1]}<span className="text-[0.65em] font-bold opacity-70">{match[2]}</span></>;
  }
  return <>{str}</>;
}

export default function DashboardPage() {
  const [add, setAdd] = useState(false);
  const profile = useAuthStore((s) => s.profile);
  const { transactions, loading, accounts, assets, liabilities, budgets, goals } = useDataStore();
  const navigate = useNavigate();
  const currency = profile?.currency || 'INR';

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setAdd(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /* ── Stat cards ── */
  const stats = useMemo(() => {
    const now = new Date();
    let income = 0, expenses = 0, monthlyIncome = 0, monthlyExpenses = 0;
    transactions.forEach((t) => {
      if (t.transfer_id) return;
      const amount = Number(t.amount);
      if (t.type === 'INCOME') {
        income += amount;
        if (isSameMonth(parseISO(t.date), now)) monthlyIncome += amount;
      } else {
        expenses += amount;
        if (isSameMonth(parseISO(t.date), now)) monthlyExpenses += amount;
      }
    });
    return { balance: income - expenses, monthlyIncome, monthlyExpenses };
  }, [transactions]);

  /* ── Net worth (accounts cash + assets − liabilities) ── */
  const netWorth = useMemo(() => {
    const cash = accounts.filter((a) => !a.is_archived).reduce((s, a) => s + Number(a.balance || 0), 0);
    const invested = assets.reduce((s, a) => s + Number(a.current_value || 0), 0);
    const owed = liabilities.reduce((s, l) => s + Number(l.remaining_balance || l.amount || 0), 0);
    return { cash, invested, owed, total: cash + invested - owed };
  }, [accounts, assets, liabilities]);

  /* ── Pie: category breakdown this month ── */
  const categoryData = useMemo(() =>
    Object.values(
      transactions
        .filter((t) => t.type === 'EXPENSE' && !t.transfer_id && isSameMonth(parseISO(t.date), new Date()))
        .reduce((acc, t) => {
          const name = t.categories?.name || 'Other';
          acc[name] ||= { name, value: 0, color: t.categories?.color || '#64748B' };
          acc[name].value += Number(t.amount);
          return acc;
        }, {})
    ),
  [transactions]);

  /* ── Bar: last 6 months income vs expense ── */
  const monthlyData = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const rows = transactions.filter((t) => isSameMonth(parseISO(t.date), d));
      return {
        month: format(d, 'MMM'),
        Income: rows.filter((x) => x.type === 'INCOME' && !x.transfer_id).reduce((s, x) => s + Number(x.amount), 0),
        Expense: rows.filter((x) => x.type === 'EXPENSE' && !x.transfer_id).reduce((s, x) => s + Number(x.amount), 0),
      };
    }),
  [transactions]);

  /* ── Area: weekly spending ── */
  const weekData = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(start, i);
      return {
        day: format(day, 'EEE'),
        value: transactions
          .filter((t) => t.type === 'EXPENSE' && !t.transfer_id && t.date === format(day, 'yyyy-MM-dd'))
          .reduce((s, x) => s + Number(x.amount), 0),
      };
    });
  }, [transactions]);

  const monthlySavings = stats.monthlyIncome - stats.monthlyExpenses;

  const cards = [
    { label: 'In accounts', value: netWorth.cash, Icon: Wallet, color: 'text-brand-700 bg-brand-50 dark:bg-brand-900/30 dark:text-brand-300', accent: 'border-t-[3px] border-t-brand-500 shadow-[0_4px_20px_-4px_rgba(15,118,110,0.15)]' },
    { label: 'Monthly income', value: stats.monthlyIncome, Icon: ArrowUpRight, color: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300', accent: 'border-t-[3px] border-t-emerald-500 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.15)]' },
    { label: 'Monthly expenses', value: stats.monthlyExpenses, Icon: ArrowDownRight, color: 'text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-300', accent: 'border-t-[3px] border-t-red-500 shadow-[0_4px_20px_-4px_rgba(239,68,68,0.15)]' },
    { label: 'Savings this month', value: monthlySavings, Icon: PiggyBank, color: monthlySavings >= 0 ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300' : 'text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-300', accent: monthlySavings >= 0 ? 'border-t-[3px] border-t-emerald-400 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.1)]' : 'border-t-[3px] border-t-red-400 shadow-[0_4px_20px_-4px_rgba(239,68,68,0.1)]' },
  ];

  /* ── Budget summary (current month) ── */
  const budgetSummary = useMemo(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const current = budgets.filter((b) => b.month === month && b.year === year);
    if (!current.length) return null;
    const totalBudgeted = current.reduce((s, b) => s + Number(b.limit_amount), 0);
    const totalSpent = current.reduce((s, b) => {
      return s + transactions
        .filter((t) => t.type === 'EXPENSE' && !t.transfer_id && Number(t.date.slice(0, 4)) === year && Number(t.date.slice(5, 7)) === month &&
          (b.scope === 'CATEGORY' ? t.category_id === b.category_id : b.scope === 'ACCOUNT' ? t.account_id === b.account_id : true))
        .reduce((sum, t) => sum + Number(t.amount), 0);
    }, 0);
    const exceeded = current.filter((b) => {
      const spent = transactions
        .filter((t) => t.type === 'EXPENSE' && !t.transfer_id && Number(t.date.slice(0, 4)) === year && Number(t.date.slice(5, 7)) === month &&
          (b.scope === 'CATEGORY' ? t.category_id === b.category_id : b.scope === 'ACCOUNT' ? t.account_id === b.account_id : true))
        .reduce((sum, t) => sum + Number(t.amount), 0);
      return spent >= Number(b.limit_amount);
    }).length;
    return { totalBudgeted, totalSpent, exceeded, count: current.length, pct: Math.min(100, totalBudgeted ? (totalSpent / totalBudgeted) * 100 : 0) };
  }, [budgets, transactions]);

  /* ── Goal summary ── */
  const goalSummary = useMemo(() => {
    if (!goals.length) return null;
    const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount || 0), 0);
    const totalSaved = goals.reduce((s, g) => s + Number(g.saved_amount || 0), 0);
    const achieved = goals.filter((g) => Number(g.saved_amount) >= Number(g.target_amount)).length;
    return { totalTarget, totalSaved, achieved, count: goals.length, pct: Math.min(100, totalTarget ? (totalSaved / totalTarget) * 100 : 0) };
  }, [goals]);

  /* ── New user check ── */
  const isNewUser = !loading && accounts.filter((a) => !a.is_archived).length <= 1 && transactions.length === 0;

  const yAxisFormatter = (val) => {
    const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£';
    return val >= 1000 ? `${symbol}${(val / 1000).toFixed(0)}k` : `${symbol}${val}`;
  };

  if (loading && !transactions.length) return <Spinner full label="Loading your data…" />;

  return (
    <>
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
          <h1 className="mt-1 text-3xl font-black">
            Hello, {profile?.full_name?.split(' ')[0] || 'there'}! 👋
          </h1>
          <p className="mt-1 font-medium text-slate-600 dark:text-slate-400">Here&apos;s your money at a glance.</p>
        </div>
        <button className="btn-primary flex items-center gap-2 transition hover:scale-[1.02] active:scale-95 shadow-[0_4px_20px_-4px_rgba(15,118,110,0.4)]" onClick={() => setAdd(true)}>
          <Plus size={18} /> Add transaction
          <span className="ml-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white border border-white/10">(N)</span>
        </button>
      </div>

      {/* New user onboarding */}
      {isNewUser && (
        <section className="card mb-6 overflow-hidden bg-gradient-to-br from-brand-50 to-emerald-50 !border-brand-100 dark:from-brand-950/30 dark:to-emerald-950/20 dark:!border-brand-900/40">
          <h2 className="text-lg font-bold">Let&apos;s set up your money 🚀</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Get started in just three steps:</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <button onClick={() => navigate('/accounts')} className="flex items-center gap-3 rounded-xl border bg-white p-4 text-left transition hover:shadow-md dark:bg-slate-900 dark:border-slate-800">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"><Wallet size={20} /></span>
              <div><p className="text-sm font-bold">Add an account</p><p className="text-xs text-slate-500">Bank, cash, wallet…</p></div>
            </button>
            <button onClick={() => setAdd(true)} className="flex items-center gap-3 rounded-xl border bg-white p-4 text-left transition hover:shadow-md dark:bg-slate-900 dark:border-slate-800">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"><Plus size={20} /></span>
              <div><p className="text-sm font-bold">Add a transaction</p><p className="text-xs text-slate-500">Income or expense</p></div>
            </button>
            <button onClick={() => navigate('/budgets')} className="flex items-center gap-3 rounded-xl border bg-white p-4 text-left transition hover:shadow-md dark:bg-slate-900 dark:border-slate-800">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"><PiggyBank size={20} /></span>
              <div><p className="text-sm font-bold">Set a budget</p><p className="text-xs text-slate-500">Control spending</p></div>
            </button>
          </div>
        </section>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, Icon, color, accent }) => (
          <div className={`card group relative overflow-hidden ${accent}`} key={label}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <span className={`rounded-xl p-2.5 transition group-hover:scale-110 ${color}`}>
                <Icon size={20} />
              </span>
            </div>
            <p className="mt-5 text-3xl font-black tracking-tight">
              <FormattedMoney value={value} currency={currency} />
            </p>
          </div>
        ))}
      </div>

      {/* Net worth banner */}
      <section className="mt-6 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-700 to-teal-700 text-white shadow-[0_8px_30px_-8px_rgba(13,148,136,0.5)]">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-brand-100"><Scale size={15} /> Net worth</p>
            <p className="mt-1 text-3xl font-black tracking-tight"><FormattedMoney value={netWorth.total} currency={currency} /></p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <div><p className="text-xs font-medium text-brand-100">Cash in accounts</p><p className="mt-0.5 text-base font-bold">{money(netWorth.cash, currency)}</p></div>
            <div><p className="text-xs font-medium text-brand-100">Investments</p><p className="mt-0.5 text-base font-bold">{money(netWorth.invested, currency)}</p></div>
            <div><p className="text-xs font-medium text-brand-100">Debt</p><p className="mt-0.5 text-base font-bold">{money(netWorth.owed, currency)}</p></div>
          </div>
          <button className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25" onClick={() => navigate('/net-worth')}>Details</button>
        </div>
      </section>

      {/* Accounts strip */}
      {accounts.filter((a) => !a.is_archived).length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Your accounts</h2>
            <button className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300" onClick={() => navigate('/accounts')}>Manage →</button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {accounts.filter((a) => !a.is_archived).map((a) => (
              <button key={a.id} onClick={() => navigate('/accounts')} className="card min-w-44 shrink-0 !p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderTop: `3px solid ${a.color}` }}>
                <p className="truncate text-sm font-semibold">{a.name}</p>
                <p className="mt-1 text-lg font-black tracking-tight">{money(a.balance, a.currency || currency)}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Budget & Goal summary strip */}
      {(budgetSummary || goalSummary) && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {budgetSummary && (
            <button onClick={() => navigate('/budgets')} className="card !p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"><PiggyBank size={18} /></span>
                  <div>
                    <p className="text-sm font-bold">Budgets</p>
                    <p className="text-xs text-slate-500">{budgetSummary.count} active this month</p>
                  </div>
                </div>
                {budgetSummary.exceeded > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 dark:bg-red-950/40 dark:text-red-400">{budgetSummary.exceeded} over</span>}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className={`h-full rounded-full transition-all duration-500 ${budgetSummary.pct >= 100 ? 'bg-red-500' : budgetSummary.pct >= 80 ? 'bg-amber-500' : 'bg-brand-600'}`} style={{ width: `${budgetSummary.pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">{money(budgetSummary.totalSpent, currency)} of {money(budgetSummary.totalBudgeted, currency)} · {Math.round(budgetSummary.pct)}%</p>
            </button>
          )}
          {goalSummary && (
            <button onClick={() => navigate('/goals')} className="card !p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300"><Target size={18} /></span>
                  <div>
                    <p className="text-sm font-bold">Goals</p>
                    <p className="text-xs text-slate-500">{goalSummary.count} goal{goalSummary.count !== 1 ? 's' : ''}{goalSummary.achieved > 0 ? ` · ${goalSummary.achieved} achieved` : ''}</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-500 transition-all duration-500" style={{ width: `${goalSummary.pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">{money(goalSummary.totalSaved, currency)} of {money(goalSummary.totalTarget, currency)} · {Math.round(goalSummary.pct)}%</p>
            </button>
          )}
        </div>
      )}

      {/* Charts row 1 */}
      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <section className="card xl:col-span-3">
          <h2 className="font-bold">Income vs Expenses</h2>
          <p className="mb-5 text-sm text-slate-500">Last six months</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis width={65} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={yAxisFormatter} />
                <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: 'transparent' }} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                <Bar dataKey="Income" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Expense" fill="#EF4444" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card xl:col-span-2">
          <h2 className="font-bold">Expense Split</h2>
          <p className="mb-5 text-sm text-slate-500">This month by category</p>
          <div className="h-72">
            {categoryData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {categoryData.map((x) => <Cell key={x.name} fill={x.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip currency={currency} />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState 
                title="No expenses this month" 
                message="Add an expense to see your category breakdown." 
                action={<button className="btn-secondary" onClick={() => setAdd(true)}>+ Add Expense</button>} 
              />
            )}
          </div>
        </section>
      </div>

      {/* Charts row 2 */}
      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <section className="card xl:col-span-3">
          <h2 className="font-bold">Weekly Spending</h2>
          <p className="mb-5 text-sm text-slate-500">Daily expenses this week</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekData}>
                <defs>
                  <linearGradient id="weekGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis width={65} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={yAxisFormatter} />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0f766e"
                  strokeWidth={2.5}
                  fill="url(#weekGrad)"
                  dot={{ fill: '#0f766e', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Recent Activity</h2>
            <TrendingUp size={16} className="text-slate-400" />
          </div>
          <div className="mt-4 divide-y">
            {transactions.slice(0, 5).map((t) => (
              <div className="flex items-center gap-3 py-3" key={t.id}>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white text-xs font-bold"
                  style={{ background: t.categories?.color || '#64748B' }}
                >
                  {t.categories?.name?.[0]?.toUpperCase() || '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.title}</p>
                  <p className="text-xs text-slate-500">{prettyDate(t.date)} · {t.categories?.name}</p>
                </div>
                <p className={`shrink-0 text-sm font-bold ${t.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {t.type === 'INCOME' ? '+' : '-'}{money(t.amount, currency)}
                </p>
              </div>
            ))}
            {!transactions.length && (
              <EmptyState title="No transactions yet" message="Add your first income or expense to get started." />
            )}
          </div>
        </section>
      </div>

      {/* Add transaction modal */}
      <Modal open={add} onClose={() => setAdd(false)} title="Add transaction">
        <TransactionForm onDone={() => setAdd(false)} />
      </Modal>
    </>
  );
}
