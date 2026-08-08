export type AuthAccountStatus = 'pending_verification' | 'active' | 'disabled';
export type AdminRole = 'user' | 'editor' | 'owner';

export interface SafeUser {
  userId: string;
  email: string;
  emailVerifiedAt: string | null;
  accountStatus: AuthAccountStatus;
  adminRole: AdminRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionResponse {
  authenticated: boolean;
  user: SafeUser | null;
  csrfToken: string | null;
  authenticatedAt: string | null;
  sessionToken?: string | null;
}

export interface AuthIdentity {
  userId: string;
  sessionId: string;
  sessionTokenHash: string;
  csrfToken: string;
  expiresAt: string;
  authenticatedAt: string | null;
}
