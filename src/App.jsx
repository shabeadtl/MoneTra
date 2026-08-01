import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import PwaSupport from './components/PwaSupport';
import Spinner from './components/Spinner';
import { useAuthStore } from './stores/authStore';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import BudgetsPage from './pages/BudgetsPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
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
  return <>
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route element={<Protected><AppLayout /></Protected>}>
        <Route index element={<DashboardPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="admin" element={<AdminGuard />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    <PwaSupport />
  </>;
}
