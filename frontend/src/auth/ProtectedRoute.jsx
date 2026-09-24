import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0f1e' }}>
      <div className="glass-card p-8 rounded-xl flex items-center gap-4 animate-pulse">
        <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>Verifying session...</span>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ permission, children }) {
  const { user, loading, can } = useAuth();

  if (loading) return <FullScreenLoader />;

  if (!user) return <Navigate to="/login" replace />;

  if (permission && !can(permission)) return <Navigate to="/" replace />;

  return children;
}