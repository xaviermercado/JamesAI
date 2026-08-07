import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { getAuthSession } from '@/services/auth-api';
import { clearAuthSessionToken, setAuthSessionToken } from '@/services/auth-session-token';
import type { AuthSessionResponse, SafeUser } from '@/types/auth';

interface AuthSessionContextValue {
  status: 'initializing' | 'authenticated' | 'anonymous';
  user: SafeUser | null;
  csrfToken: string | null;
  refreshSession: () => Promise<void>;
  applySession: (session: AuthSessionResponse) => void;
  clearSession: () => void;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthSessionContextValue['status']>('initializing');
  const [user, setUser] = useState<SafeUser | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const applySession = useCallback((session: AuthSessionResponse) => {
    setStatus(session.authenticated ? 'authenticated' : 'anonymous');
    setUser(session.user);
    setCsrfToken(session.csrfToken);

    if (session.sessionToken) {
      setAuthSessionToken(session.sessionToken);
    }

    if (!session.authenticated) {
      clearAuthSessionToken();
    }
  }, []);

  const clearSession = useCallback(() => {
    setStatus('anonymous');
    setUser(null);
    setCsrfToken(null);
    clearAuthSessionToken();
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const session = await getAuthSession();
      applySession(session);
    } catch {
      clearSession();
    }
  }, [applySession, clearSession]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void refreshSession();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [refreshSession]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const onUnauthorized = () => {
      clearSession();
    };

    window.addEventListener('jamesai:unauthorized', onUnauthorized);
    return () => {
      window.removeEventListener('jamesai:unauthorized', onUnauthorized);
    };
  }, [clearSession]);

  return <AuthSessionContext.Provider value={{ status, user, csrfToken, refreshSession, applySession, clearSession }}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error('useAuthSession must be used within AuthSessionProvider');
  }

  return context;
}
