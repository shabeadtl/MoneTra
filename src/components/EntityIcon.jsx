import {
  BadgePercent, Bitcoin, Building2, CalendarClock, CandlestickChart, Car, CircleDollarSign, Coins,
  CreditCard, Folder, Gem, Gift, GraduationCap, HandCoins, Heart, Home, Landmark, Laptop, PieChart,
  PiggyBank, Plane, Rocket, Smartphone, Store, Target, TrendingUp, Wallet,
} from 'lucide-react';

// Resolves icon names stored in the DB (accounts/assets/liabilities/goals) to components.
const MAP = {
  Wallet, PiggyBank, Landmark, CreditCard, HandCoins, TrendingUp, Smartphone, Store, Coins, Folder,
  Gem, CandlestickChart, Bitcoin, Building2, BadgePercent, CalendarClock, Home, Target,
  Rocket, Car, GraduationCap, Laptop, Plane, Gift, Heart, PieChart,
};

export default function EntityIcon({ name = 'Wallet', size = 20, className, style }) {
  const Icon = MAP[name] || CircleDollarSign;
  return <Icon size={size} className={className} style={style} />;
}
