import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, TOKEN_KEY } from '../services/api';
import { AuthUser, Role } from '../types';

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, role?: Role) => Promise<AuthUser>;
  logout: () => void;
}
const Ctx = createContext<AuthCtx | null>(null);
/** Exported so tests can render pages with a chosen user. */
export const AuthContext = Ctx;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(!!localStorage.getItem(TOKEN_KEY));

  const logout = useCallback(() => {
    api('/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    if (localStorage.getItem(TOKEN_KEY)) api<AuthUser>('/auth/me').then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
    const onLogout = () => setUser(null);
    window.addEventListener('sc:logout', onLogout);
    return () => window.removeEventListener('sc:logout', onLogout);
  }, []);

  const login: AuthCtx['login'] = async (email, password, role) => {
    const { token, user } = await api<{ token: string; user: AuthUser }>('/auth/login', { method: 'POST', json: { email, password, role } });
    localStorage.setItem(TOKEN_KEY, token);
    setUser(user);
    return user;
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
};
