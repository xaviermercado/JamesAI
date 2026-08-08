export interface SafeUser {
  userId: string;
  email: string;
  emailVerifiedAt: string | null;
  accountStatus: 'pending_verification' | 'active' | 'disabled';
  adminRole: 'user' | 'editor' | 'owner';
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionResponse {
  authenticated: boolean;
  user: SafeUser | null;
  csrfToken: string | null;
  authenticatedAt?: string | null;
  sessionToken?: string | null;
}

export interface SignupInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}