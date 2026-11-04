/**
 * AuthContext: who is logged in, shared with every component.
 * The real session lives in an httpOnly cookie on the server; this context
 * just remembers the user object returned by /api/auth/me.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [unread, setUnread] = useState(0);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
      setUnread(data.unreadNotifications || 0);
      setDemoMode(Boolean(data.demoMode));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // If the server says our session ended, forget the user.
    const onUnauthorised = () => setUser(null);
    window.addEventListener('kl:unauthorised', onUnauthorised);
    return () => window.removeEventListener('kl:unauthorised', onUnauthorised);
  }, [refresh]);

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    setUnread(0);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, unread, setUnread, demoMode, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

/** Where each role lands after logging in. */
export function homeFor(role) {
  if (role === 'agent') return '/agent';
  if (role === 'admin' || role === 'super_admin') return '/admin';
  return '/listings';
}
