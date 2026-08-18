import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/store';

interface Props {
  requireAdmin?: boolean;
}

/** Auth gerektiren rotaları korur; admin rotalarında rol de kontrol eder. */
export default function ProtectedRoute({ requireAdmin = false }: Props) {
  const { isAuthenticated, role } = useAppSelector((s) => s.auth);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requireAdmin && role !== 'Admin') return <Navigate to="/" replace />;

  return <Outlet />;
}
