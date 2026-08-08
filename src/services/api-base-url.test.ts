import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveApiBaseUrl } from './api-base-url';

describe('resolveApiBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('normalizes a configured HTTPS endpoint', () => {
    expect(resolveApiBaseUrl('https://jamesai-fmm4.onrender.com/')).toBe('https://jamesai-fmm4.onrender.com');
  });

  it('rejects insecure configured endpoints in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => resolveApiBaseUrl('http://10.0.0.117:3001')).toThrow('must use HTTPS in production');
  });

  it('allows an HTTP endpoint during local development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(resolveApiBaseUrl('http://localhost:3001/')).toBe('http://localhost:3001');
  });
});