import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "@/store";

interface Props {
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ requireAdmin = false }: Props) {
  const { isAuthenticated, isSessionChecked, role } = useAppSelector(
    (s) => s.auth,
  );

  if (!isSessionChecked) return null; // SessionManager oturumu doğrularken bekle
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requireAdmin && role !== "Admin") return <Navigate to="/" replace />;
  return <Outlet />;
}
