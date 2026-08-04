const blockedTargets = new Set(['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email']);

export function getSafeRedirectPath(redirectTo?: string | string[]): string | null {
  const value = Array.isArray(redirectTo) ? redirectTo[0] : redirectTo;
  if (!value || !value.startsWith('/')) {
    return null;
  }

  if (value.startsWith('//') || value.includes('://')) {
    return null;
  }

  const pathOnly = value.split('?')[0] ?? value;
  if (blockedTargets.has(pathOnly)) {
    return null;
  }

  return value;
}