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

  if (permission && !can(permission)) return <AccessDenied />;

  return children;
}

export function AccessDenied() {
  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="glass-card p-8 rounded-xl max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ background: '#ef444420' }}>
          <svg className="w-8 h-8" style={{ color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636M12 8v4m0 4h.01" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Access Denied</h1>
          <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
            You do not have permission to view this page. Your current role does not allow this action.
          </p>
        </div>
        <div>
          <a
            href="/"
            className="inline-block px-6 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}