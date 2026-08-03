import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getAuthSession, type AuthSessionResponse, type SafeUser } from '@/services/auth-api';

interface AuthSessionContextValue {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  user: SafeUser | null;
  csrfToken: string | null;
  refreshSession: () => Promise<void>;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthSessionContextValue['status']>('loading');
  const [user, setUser] = useState<SafeUser | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const refreshSession = async () => {
    try {
      const session = await getAuthSession();
      applySession(session);
    } catch {
      setStatus('unauthenticated');
      setUser(null);
      setCsrfToken(null);
    }
  };

  const applySession = (session: AuthSessionResponse) => {
    setStatus(session.authenticated ? 'authenticated' : 'unauthenticated');
    setUser(session.user);
    setCsrfToken(session.csrfToken);
  };

  useEffect(() => {
    void refreshSession();
  }, []);

  return <AuthSessionContext.Provider value={{ status, user, csrfToken, refreshSession }}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error('useAuthSession must be used within AuthSessionProvider');
  }

  return context;
}
