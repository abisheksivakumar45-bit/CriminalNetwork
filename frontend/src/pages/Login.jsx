import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await login(username.trim(), password);
      navigate(from === '/login' ? '/' : from, { replace: true });
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        setError('Too many login attempts. Please try again later.');
      } else {
        setError('Invalid username or password.');
      }
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-layout">
      <div
        className="min-h-screen w-full flex items-center justify-center p-6"
        style={{
          background:
            'radial-gradient(1000px 500px at 15% -10%, rgba(59,130,246,0.18), transparent), ' +
            'radial-gradient(800px 500px at 110% 110%, rgba(6,182,212,0.14), transparent), ' +
            '#0a0e1a',
        }}
      >
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div
              className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-4"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', boxShadow: '0 0 40px rgba(59,130,246,0.35)' }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white">CrimeNet</h1>
            <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Criminal Network Analysis — SIH26189</p>
          </div>

          <form onSubmit={handleSubmit} className="glass-card p-8 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-400 block mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="Enter your username"
                className="w-full px-4 py-3 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: '#111827', border: '1px solid #1e3a5f' }}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-400 block mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
                className="w-full px-4 py-3 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: '#111827', border: '1px solid #1e3a5f' }}
              />
            </div>

            {error && (
              <div className="p-2 rounded-lg text-sm" style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-8 py-3 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
            >
              {submitting ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Signing in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm" style={{ color: '#64748b' }}>
              Don't have an account?{' '}
              <a
                href="/register"
                className="font-medium text-blue-400 underline hover:text-white"
              >
                Create Account
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}