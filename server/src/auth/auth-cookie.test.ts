import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../config/env';
import { getSessionCookieOptions, resolveSameSite } from './auth-cookie';

function createConfig(): AppConfig {
  return {
    port: 3001,
    nodeEnv: 'production',
    tmdbTimeoutMs: 8000,
    openAiModel: 'gpt-4.1-mini',
    openAiTimeoutMs: 8000,
    frontendOrigin: 'https://app.scouty.ca',
    appBaseUrl: 'https://app.scouty.ca',
    emailProvider: 'console',
    emailTokenPepper: 'y'.repeat(32),
    database: null,
    sessionTokenPepper: 'x'.repeat(32),
  };
}

describe('auth cookie SameSite policy', () => {
  it('defaults to Lax for same-site requests', () => {
    const config = createConfig();
    const sameSite = resolveSameSite(config, {
      requestOrigin: 'https://app.scouty.ca',
      requestHost: 'api.scouty.ca',
      requestProtocol: 'https',
    });

    expect(sameSite).toBe('lax');
  });

  it('uses None for cross-site frontend->API requests when not explicitly overridden', () => {
    const config = createConfig();
    const options = getSessionCookieOptions(config, {
      requestOrigin: 'https://scouty.ca',
      requestHost: 'scouty-api.onrender.com',
      requestProtocol: 'https',
    });

    expect(options.sameSite).toBe('none');
    expect(options.secure).toBe(true);
    expect(options.httpOnly).toBe(true);
    expect((options as { partitioned?: boolean }).partitioned).toBe(true);
  });

  it('still enforces SameSite=None for cross-site requests even with explicit override', () => {
    const config = createConfig();
    config.authCookieSameSite = 'strict';

    const sameSite = resolveSameSite(config, {
      requestOrigin: 'https://scouty.ca',
      requestHost: 'scouty-api.onrender.com',
      requestProtocol: 'https',
    });

    expect(sameSite).toBe('none');
  });

  it('respects explicit SameSite override for same-site requests', () => {
    const config = createConfig();
    config.authCookieSameSite = 'strict';

    const sameSite = resolveSameSite(config, {
      requestOrigin: 'https://app.scouty.ca',
      requestHost: 'api.scouty.ca',
      requestProtocol: 'https',
    });

    expect(sameSite).toBe('strict');
  });

  it('does not mark same-site cookies as partitioned', () => {
    const config = createConfig();
    const options = getSessionCookieOptions(config, {
      requestOrigin: 'https://app.scouty.ca',
      requestHost: 'api.scouty.ca',
      requestProtocol: 'https',
    });

    expect((options as { partitioned?: boolean }).partitioned).toBeUndefined();
  });
});
