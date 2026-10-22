import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function ProtectedRoute({ children, role, requireAdmin }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center">
        <p className="text-slate-500 font-mono text-sm">Loading...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && !profile?.is_admin) return <Navigate to="/" replace />;
  if (role && !requireAdmin && profile?.role !== role) return <Navigate to="/" replace />;

  return children;
}