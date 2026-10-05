/**
 * Authentication state for the whole app.
 *
 * Token storage: the JWT is kept in sessionStorage rather than
 * localStorage, so it is discarded when the tab/browser closes and isn't
 * shared across tabs. Any script running on the page could read it, which
 * is why XSS defence matters so much: React escapes all rendered text, the
 * API strips markup from stored data, and the CSP only allows our own
 * bundled scripts to run. The token also expires after 1 hour.
 *
 * On startup a stored token is re-validated with GET /api/users/me, so a
 * tampered or expired token is discarded immediately. The role shown in the
 * UI therefore always comes from the server, not from decoding the token
 * in the browser.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken, setUnauthorizedHandler } from '../api/client';

const TOKEN_KEY = 'hh_token';
const AuthContext = createContext(null);

function readStoredToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // Storage can be blocked (privacy mode) - fall back to logged-out.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(readStoredToken()));
  const [sessionExpired, setSessionExpired] = useState(false);

  const clearSession = useCallback(() => {
    setAuthToken(null);
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      setSessionExpired(true);
    });

    const token = readStoredToken();
    if (!token) return;
    setAuthToken(token);
    api
      .me()
      .then((res) => setUser(res.data))
      .catch(() => clearSession())
      .finally(() => setLoading(false));
  }, [clearSession]);

  const login = useCallback(async (email, password) => {
    const res = await api.login(email, password);
    setAuthToken(res.token);
    try {
      sessionStorage.setItem(TOKEN_KEY, res.token);
    } catch {
      /* ignore - session just won't survive a reload */
    }
    setSessionExpired(false);
    setUser(res.data);
    return res.data;
  }, []);

  const register = useCallback((data) => api.register(data), []);

  const logout = useCallback(() => {
    clearSession();
    setSessionExpired(false);
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, loading, sessionExpired, login, register, logout }),
    [user, loading, sessionExpired, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// The hook lives beside its provider on purpose (standard context pattern); it only affects hot-reload granularity.
// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

