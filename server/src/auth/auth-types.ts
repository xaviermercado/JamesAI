export type AuthAccountStatus = 'pending_verification' | 'active' | 'disabled';

export interface SafeUser {
  userId: string;
  email: string;
  emailVerifiedAt: string | null;
  accountStatus: AuthAccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionResponse {
  authenticated: boolean;
  user: SafeUser | null;
  csrfToken: string | null;
  sessionToken?: string | null;
}

export interface AuthIdentity {
  userId: string;
  sessionId: string;
  sessionTokenHash: string;
  csrfToken: string;
  expiresAt: string;
}
