const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const indexingEnabled = process.env.EXPO_PUBLIC_SITE_INDEXING_ENABLED === 'true';

if (indexingEnabled && (!apiBaseUrl || !apiBaseUrl.startsWith('https://'))) {
  throw new Error('Production web exports require an explicit HTTPS EXPO_PUBLIC_API_BASE_URL');
}
