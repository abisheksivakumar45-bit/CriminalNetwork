import { NavLink } from 'react-router-dom';
import { useAuth, ROLE_LABELS } from '../auth/AuthContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', permission: 'dashboard' },
  { path: '/cases', label: 'Cases', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', permission: 'cases' },
  { path: '/network', label: 'Knowledge Graph', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1', permission: 'knowledge_graph' },
  { path: '/analysis', label: 'Network Analysis', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', permission: 'network_analysis' },
  { path: '/search', label: 'Entity Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', permission: 'entity_search' },
  { path: '/natural-search', label: 'Natural Language Search', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', permission: 'natural_search' },
  { path: '/investigation', label: 'Investigation', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', permission: 'investigation' },
  { path: '/add-case', label: 'Add Case', icon: 'M12 4v16m8-8H4', permission: 'add_case' },
  { path: '/users', label: 'Users', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', permission: 'users' },
];

const ROLE_COLORS = { admin: '#8b5cf6', investigator: '#3b82f6', analyst: '#06b6d4' };

export default function Sidebar() {
  const { user, logout, can } = useAuth();
  const role = user?.role || null;
  const visibleItems = navItems.filter((item) => can(item.permission));
  const roleColor = ROLE_COLORS[role] || '#94a3b8';

  return (
    <aside className="app-sidebar flex flex-col" style={{ background: 'linear-gradient(180deg, #0d1525 0%, #111827 100%)', borderRight: '1px solid #1e3a5f' }}>
      <div className="p-5 border-b flex-shrink-0" style={{ borderColor: '#1e3a5f' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white">CrimeNet</h1>
            <p className="text-xs" style={{ color: '#94a3b8' }}>Network Analysis</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`
            }
            style={({ isActive }) => isActive ? { background: 'rgba(59, 130, 246, 0.15)', borderLeft: '3px solid #3b82f6' } : { borderLeft: '3px solid transparent' }}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
            </svg>
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t flex-shrink-0 space-y-2" style={{ borderColor: '#1e3a5f' }}>
        {user && (
          <div className="glass-card p-3 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {user.display_name || user.username}
                </p>
                <p className="text-xs font-mono truncate" style={{ color: '#64748b' }}>@{user.username}</p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0" style={{ background: `${roleColor}20`, color: roleColor }}>
                {ROLE_LABELS[role] || role}
              </span>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
              style={{ border: '1px solid #1e3a5f', color: '#94a3b8' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        )}
        <p className="text-xs" style={{ color: '#64748b' }}>Synthetic Data — SIH26189</p>
      </div>
    </aside>
  );
}
