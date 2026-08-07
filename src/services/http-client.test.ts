import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpRequestError, requestJson } from './http-client';

describe('requestJson unauthorized handling', () => {
  const originalWindow = globalThis.window;
  const dispatchEvent = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('window', {
      dispatchEvent,
    } as unknown as Window & typeof globalThis);
    dispatchEvent.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.window = originalWindow;
  });

  it('dispatches unauthorized event and throws status-aware error on 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    } as Response);

    await expect(requestJson('/api/profile', { method: 'GET' }))
      .rejects
      .toMatchObject({
        name: 'HttpRequestError',
        message: 'Unauthorized',
        status: 401,
      });

    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect((dispatchEvent.mock.calls[0]?.[0] as Event).type).toBe('jamesai:unauthorized');
  });

  it('does not dispatch unauthorized event for non-401 failures', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden' }),
    } as Response);

    await expect(requestJson('/api/profile', { method: 'PATCH' })).rejects.toBeInstanceOf(HttpRequestError);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
