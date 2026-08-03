import { describe, expect, it, vi } from 'vitest';

import { checkDatabaseReadiness } from './readiness';

describe('checkDatabaseReadiness', () => {
  it('reports not configured when no pool is provided', async () => {
    await expect(checkDatabaseReadiness({ pool: null })).resolves.toEqual({ status: 'not_configured' });
  });

  it('reports ready after a successful ping', async () => {
    const release = vi.fn();
    const query = vi.fn().mockResolvedValue(undefined);
    const pool = {
      getConnection: vi.fn().mockResolvedValue({ query, release }),
    } as never;

    await expect(checkDatabaseReadiness({ pool })).resolves.toEqual({ status: 'ready' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
    expect(release).toHaveBeenCalled();
  });

  it('reports unavailable when the connection fails', async () => {
    const pool = {
      getConnection: vi.fn().mockRejectedValue(new Error('down')),
    } as never;

    await expect(checkDatabaseReadiness({ pool })).resolves.toEqual({ status: 'unavailable' });
  });
});
