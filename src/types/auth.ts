export interface SafeUser {
  userId: string;
  email: string;
  emailVerifiedAt: string | null;
  accountStatus: 'pending_verification' | 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionResponse {
  authenticated: boolean;
  user: SafeUser | null;
  csrfToken: string | null;
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