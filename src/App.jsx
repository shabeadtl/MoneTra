import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import PwaSupport from './components/PwaSupport';
import Spinner from './components/Spinner';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuthStore } from './stores/authStore';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import AccountsPage from './pages/AccountsPage';
import TransactionsPage from './pages/TransactionsPage';
import BudgetsPage from './pages/BudgetsPage';
import GoalsPage from './pages/GoalsPage';
import NetWorthPage from './pages/NetWorthPage';
import ReportsPage from './pages/ReportsPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import TransfersPage from './pages/TransfersPage';
import CategoriesPage from './pages/CategoriesPage';
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';

function Protected({ children }) {
  const { session, loading } = useAuthStore();
  if (loading) return <Spinner full />;
  return session ? children : <Navigate to="/login" replace />;
}
function AdminGuard() {
  const user = useAuthStore((s) => s.user);
  return user?.app_metadata?.is_staff || user?.app_metadata?.role === 'admin' ? <AdminPage /> : <Navigate to="/" replace />;
}
export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route element={<Protected><AppLayout /></Protected>}>
          <Route index element={<DashboardPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="transfers" element={<TransfersPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="net-worth" element={<NetWorthPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<AdminGuard />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <PwaSupport />
    </ErrorBoundary>
  );
}
