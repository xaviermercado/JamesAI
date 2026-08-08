export function resolveApiBaseUrl(explicitBaseUrl?: string): string {
  const configuredBaseUrl = (explicitBaseUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim();

  if (configuredBaseUrl) {
    const normalizedBaseUrl = configuredBaseUrl.replace(/\/$/, '');
    if (process.env.NODE_ENV === 'production' && !normalizedBaseUrl.startsWith('https://')) {
      throw new Error('EXPO_PUBLIC_API_BASE_URL must use HTTPS in production');
    }
    return normalizedBaseUrl;
  }

  if (typeof window !== 'undefined' && typeof window.location?.hostname === 'string') {
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    return `${protocol}://${window.location.hostname}:3001`;
  }

  return 'http://localhost:3001';
}
