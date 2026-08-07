type ProfileService = 'letterboxd' | 'tvtime';

const USERNAME_PATTERN = /^[a-z0-9._-]{2,64}$/i;

function normalizeCandidate(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

function extractFromSupportedUrl(service: ProfileService, raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.toLowerCase();
    const path = url.pathname.replace(/^\/+|\/+$/g, '');

    if (service === 'letterboxd') {
      if (host !== 'letterboxd.com' && host !== 'www.letterboxd.com') {
        return null;
      }

      const [username, maybeExtra] = path.split('/');
      if (!username || maybeExtra) {
        return null;
      }

      return normalizeCandidate(username);
    }

    if (service === 'tvtime') {
      if (host !== 'tvtime.com' && host !== 'www.tvtime.com') {
        return null;
      }

      const parts = path.split('/').filter(Boolean);
      if (parts.length !== 2 || parts[0].toLowerCase() !== 'user') {
        return null;
      }

      return normalizeCandidate(parts[1]);
    }
  } catch {
    return null;
  }

  return null;
}

export function normalizeProfileUsername(service: ProfileService, input: string | null | undefined): string | null {
  const trimmed = input?.trim() ?? '';
  if (!trimmed) {
    return null;
  }

  const fromUrl = extractFromSupportedUrl(service, trimmed);
  const candidate = fromUrl ?? normalizeCandidate(trimmed);

  if (!USERNAME_PATTERN.test(candidate)) {
    throw new Error(`Invalid ${service} username`);
  }

  return candidate;
}

export function buildLetterboxdProfileUrl(username: string | null): string | null {
  if (!username) {
    return null;
  }

  return `https://letterboxd.com/${encodeURIComponent(username)}/`;
}
