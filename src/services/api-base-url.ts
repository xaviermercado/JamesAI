export function resolveApiBaseUrl(explicitBaseUrl?: string): string {
  const configuredBaseUrl = (explicitBaseUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && typeof window.location?.hostname === 'string') {
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    return `${protocol}://${window.location.hostname}:3001`;
  }

  return 'http://localhost:3001';
}
