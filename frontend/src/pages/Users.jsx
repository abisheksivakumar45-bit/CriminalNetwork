import { useEffect, useState } from 'react';
import { getAuthUsers, createAuthUser } from '../api';

const ROLE_COLORS = { admin: '#8b5cf6', investigator: '#3b82f6', analyst: '#06b6d4' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    username: '',
    password: '',
    role: 'analyst',
    display_name: '',
    email: '',
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const loadUsers = () => {
    setLoading(true);
    setError('');
    getAuthUsers()
      .then((res) => setUsers(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Could not load users.'))
      .finally(() => setLoading(false));
  };

  useEffect(loadUsers, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setFormError('Username and password are required.');
      return;
    }
    if (form.password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    setCreating(true);
    setFormError('');
    try {
      await createAuthUser(form);
      setForm({ username: '', password: '', role: 'analyst', display_name: '', email: '' });
      setFormOpen(false);
      loadUsers();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Could not create user.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-sm" style={{ color: '#94a3b8' }}>Administrator access — manage application accounts</p>
        </div>
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="px-4 py-2.5 rounded-lg text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
        >
          {formOpen ? 'Close' : '+ New User'}
        </button>
      </div>

      {formOpen && (
        <form onSubmit={handleCreate} className="glass-card p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1">Username</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: '#111827', border: '1px solid #1e3a5f' }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min 8 characters"
                className="w-full px-4 py-2.5 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: '#111827', border: '1px solid #1e3a5f' }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: '#111827', border: '1px solid #1e3a5f' }}
              >
                <option value="analyst">Analyst (read-only)</option>
                <option value="investigator">Investigator (add cases)</option>
                <option value="admin">Admin (full access)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 block mb-1">Display Name</label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ background: '#111827', border: '1px solid #1e3a5f' }}
              />
            </div>
          </div>
          {formError && (
            <div className="p-3 rounded-lg text-sm" style={{ background: '#ef444420', color: '#ef4444' }}>
              {formError}
            </div>
          )}
          <button
            type="submit"
            disabled={creating}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
            style={{ background: '#3b82f6' }}
          >
            {creating ? 'Creating...' : 'Create User'}
          </button>
        </form>
      )}

      <div className="glass-card p-6 rounded-xl">
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <span className="text-sm" style={{ color: '#94a3b8' }}>Loading users...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg text-sm" style={{ background: '#ef444420', color: '#ef4444' }}>
            {error}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: '#64748b' }}>
                  <th className="py-2 px-3 font-medium">Username</th>
                  <th className="py-2 px-3 font-medium">Display Name</th>
                  <th className="py-2 px-3 font-medium">Email</th>
                  <th className="py-2 px-3 font-medium">Role</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.username} className="border-t" style={{ borderColor: '#1e3a5f' }}>
                    <td className="py-3 px-3 text-white font-mono">{u.username}</td>
                    <td className="py-3 px-3" style={{ color: '#cbd5e1' }}>{u.display_name}</td>
                    <td className="py-3 px-3" style={{ color: '#94a3b8' }}>{u.email}</td>
                    <td className="py-3 px-3">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${ROLE_COLORS[u.role]}20`, color: ROLE_COLORS[u.role] || '#94a3b8' }}>
                        {(u.role || '').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-xs flex items-center gap-1.5" style={{ color: u.active ? '#10b981' : '#ef4444' }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: u.active ? '#10b981' : '#ef4444' }} />
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}