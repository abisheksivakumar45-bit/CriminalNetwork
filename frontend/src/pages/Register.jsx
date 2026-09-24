import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { register as apiRegister } from '../api';

export default function Register() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('analyst');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Separate validation for each field — only submit when all fields are valid.
    if (!username.trim()) {
      setError('Please enter a username.');
      return;
    }
    if (!password) {
      setError('Please enter a password.');
      return;
    }
    if (!confirmPassword) {
      setError('Please confirm your password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiRegister(username.trim(), password, role);
      // Registration does not create a session — send the user to Login.
      navigate('/login', { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 409) {
        setError('Username already exists. Please choose another.');
      } else if (status === 422) {
        setError(typeof detail === 'string' ? detail : 'Validation error: password must be at least 8 characters.');
      } else if (status === 403) {
        setError(typeof detail === 'string' ? detail : 'This account type is not available for self-registration.');
      } else {
        setError('Registration failed. Please try again.');
      }
      setPassword('');
      setConfirmPassword('');
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
          <div className="text-center mb-8">
            <div
              className="w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', boxShadow: '0 0 40px rgba(59,130,246,0.35)' }}
            >
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white">CrimeNet</h1>
            <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>Criminal Network Analysis — SIH26189</p>
          </div>

          <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1.5">Username</label>
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
              <label className="text-xs font-medium text-gray-400 block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Enter your password"
                className="w-full px-4 py-3 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: '#111827', border: '1px solid #1e3a5f' }}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Confirm your password"
                className="w-full px-4 py-3 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: '#111827', border: '1px solid #1e3a5f' }}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1.5">Account Type</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-3 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: '#111827', border: '1px solid #1e3a5f' }}
              >
                <option value="analyst">Analyst</option>
                <option value="investigator">Investigator</option>
              </select>
              <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#64748b' }}>
                {role === 'investigator'
                  ? 'Investigator — Investigate cases and add case information.'
                  : 'Analyst — View and analyze case information.'}
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg text-sm" style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>
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
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-sm" style={{ color: '#64748b' }}>
              Already have an account?{' '}
              <a
                href="/login"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/login');
                }}
                className="text-blue-400 underline hover:text-white"
              >
                Login
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}