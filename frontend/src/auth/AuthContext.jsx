import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, login as apiLogin, logout as apiLogout } from '../api';

// Role → permitted UI areas. This mirrors backend authorization (which is
// authoritative); it only controls visibility/navigation for convenience.
export const ROLE_PERMISSIONS = {
  admin: ['dashboard', 'cases', 'knowledge_graph', 'network_analysis', 'entity_search', 'investigation', 'add_case', 'users'],
  investigator: ['dashboard', 'cases', 'knowledge_graph', 'network_analysis', 'entity_search', 'investigation', 'add_case'],
  analyst: ['dashboard', 'cases', 'knowledge_graph', 'network_analysis', 'entity_search', 'investigation'],
};

export const ROLE_LABELS = {
  admin: 'Admin',
  investigator: 'Investigator',
  analyst: 'Analyst',
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCurrentUser()
      .then((res) => {
        if (mounted) setUser(res.data.user);
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const onSessionExpired = () => setUser(null);
    window.addEventListener('auth:session-expired', onSessionExpired);
    return () => {
      mounted = false;
      window.removeEventListener('auth:session-expired', onSessionExpired);
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await apiLogin(username, password);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Best-effort: always clear local state even if the server is unreachable.
    }
    setUser(null);
  }, []);

  const can = useCallback((permission) => {
    if (!user) return false;
    return (ROLE_PERMISSIONS[user.role] || []).includes(permission);
  }, [user]);

  const permissions = user ? (ROLE_PERMISSIONS[user.role] || []) : [];

  const value = useMemo(
    () => ({ user, role: user?.role || null, permissions, loading, login, logout, can }),
    [user, permissions, loading, login, logout, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}