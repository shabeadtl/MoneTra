// Shared domain metadata — account types, asset types, liability types, goals.
// Keeps icon/color/label definitions in one place so every page stays consistent.

export const ACCOUNT_TYPES = {
  CASH:          { label: 'Cash',           icon: 'Wallet',           color: '#0D9488' },
  SAVINGS:       { label: 'Savings',        icon: 'PiggyBank',        color: '#10B981' },
  CURRENT:       { label: 'Current',        icon: 'Landmark',         color: '#3B82F6' },
  CREDIT_CARD:   { label: 'Credit card',    icon: 'CreditCard',       color: '#F59E0B' },
  LOAN:          { label: 'Loan account',   icon: 'HandCoins',        color: '#EF4444' },
  INVESTMENT:    { label: 'Investment',     icon: 'TrendingUp',       color: '#8B5CF6' },
  DIGITAL_WALLET:{ label: 'Digital wallet', icon: 'Smartphone',       color: '#06B6D4' },
  BUSINESS:      { label: 'Business',       icon: 'Store',            color: '#EC4899' },
  OTHER:         { label: 'Other',          icon: 'Coins',            color: '#64748B' },
};

export const ASSET_TYPES = {
  GOLD:         { label: 'Gold',          icon: 'Gem',       color: '#F59E0B' },
  STOCKS:       { label: 'Stocks',        icon: 'CandlestickChart', color: '#3B82F6' },
  CRYPTOCURRENCY:{ label: 'Cryptocurrency', icon: 'Bitcoin', color: '#F97316' },
  REAL_ESTATE:  { label: 'Real estate',   icon: 'Building2', color: '#8B5CF6' },
  MUTUAL_FUNDS: { label: 'Mutual funds',  icon: 'PieChart',  color: '#06B6D4' },
  FIXED_DEPOSIT:{ label: 'Fixed deposit', icon: 'BadgePercent', color: '#10B981' },
  OTHER:        { label: 'Other',         icon: 'Coins',     color: '#64748B' },
};

export const LIABILITY_TYPES = {
  CREDIT_CARD: { label: 'Credit card', icon: 'CreditCard', color: '#F59E0B' },
  LOAN:        { label: 'Loan',        icon: 'Landmark',   color: '#EF4444' },
  DEBT:        { label: 'Debt',        icon: 'HandCoins',  color: '#F97316' },
  EMI:         { label: 'EMI',         icon: 'CalendarClock', color: '#8B5CF6' },
  MORTGAGE:    { label: 'Mortgage',    icon: 'Home',       color: '#3B82F6' },
  OTHER:       { label: 'Other',       icon: 'Coins',      color: '#64748B' },
};

export const GOAL_PRIORITIES = {
  LOW:    { label: 'Low',    color: '#64748B', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  MEDIUM: { label: 'Medium', color: '#3B82F6', badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
  HIGH:   { label: 'High',   color: '#EF4444', badge: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
};

export const GOAL_ICONS = ['Target', 'Rocket', 'Home', 'Car', 'GraduationCap', 'Laptop', 'PiggyBank', 'Plane', 'Gift', 'Heart'];

// Icon name → lucide component is resolved by a tiny map in components that render icons.
export const ICON_MAP = {
  Wallet: 'Wallet', PiggyBank: 'PiggyBank', Landmark: 'Landmark', CreditCard: 'CreditCard',
  HandCoins: 'HandCoins', TrendingUp: 'TrendingUp', Smartphone: 'Smartphone', Store: 'Store',
  Coins: 'Coins', Folder: 'Folder', Gem: 'Gem', CandlestickChart: 'CandlestickChart', Bitcoin: 'Bitcoin',
  Building2: 'Building2', PieChart: 'PieChart', BadgePercent: 'BadgePercent',
  CalendarClock: 'CalendarClock', Home: 'Home', Target: 'Target', Rocket: 'Rocket',
  Car: 'Car', GraduationCap: 'GraduationCap', Laptop: 'Laptop', Plane: 'Plane', Gift: 'Gift', Heart: 'Heart',
};

export function metaOf(map, key) {
  return map[key] || map.OTHER || { label: key || '—', icon: 'Coins', color: '#64748B' };
}
