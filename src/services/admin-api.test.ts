import { afterEach, describe, expect, it, vi } from 'vitest';

import { compareConfigurationVersions, listAdminAccessCandidates, listConfigurations, runConfigurationSandbox, saveConfigurationDraft, updateAdminAccess } from './admin-api';
import { BASELINE_CONFIGURATION } from '../components/admin/guidance-helpers';

function jsonResponse(payload: unknown) {
  return Promise.resolve({ ok: true, json: async () => payload } as Response);
}

describe('admin API client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('encodes bounded list and comparison queries on the router contract paths', async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => jsonResponse({ items: [] }))
      .mockImplementationOnce(() => jsonResponse({ warnings: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await listConfigurations(25, 50);
    await compareConfigurationVersions({
      startDate: '2026-08-01',
      endDate: '2026-08-07',
      baselineVersionId: 'baseline',
      comparisonVersionId: 'comparison',
    });

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/admin\/configurations\?limit=25&offset=50$/);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/admin/insights/version-comparison?');
    expect(String(fetchMock.mock.calls[1][0])).toContain('baselineVersionId=baseline');
  });

  it('uses PUT for draft saves and includes CSRF on protected mutations', async () => {
    const stored = {
      configurationId: '11111111-1111-4111-8111-111111111111',
      configuration: BASELINE_CONFIGURATION,
    };
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => jsonResponse(stored))
      .mockImplementationOnce(() => jsonResponse({ activeConfigurationId: 'active', selectedConfigurationId: 'selected', results: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await saveConfigurationDraft(stored.configurationId, 2, BASELINE_CONFIGURATION, 'Tune discovery', 'csrf-value');
    await runConfigurationSandbox(stored.configurationId, [{ description: 'Comedy', mediaType: 'movie' }], 'csrf-value');

    const saveInit = fetchMock.mock.calls[0][1] as RequestInit;
    const sandboxInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect(saveInit.method).toBe('PUT');
    expect(new Headers(saveInit.headers).get('X-CSRF-Token')).toBe('csrf-value');
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/api\/admin\/sandbox$/);
    expect(new Headers(sandboxInit.headers).get('X-CSRF-Token')).toBe('csrf-value');
  });

  it('uses bounded access listing and a CSRF-protected role mutation', async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => jsonResponse({ items: [] }))
      .mockImplementationOnce(() => jsonResponse({ status: 'updated', item: {}, revokedSessions: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    await listAdminAccessCandidates(25, 50);
    await updateAdminAccess('user-id', 'editor', 'csrf-value');

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/admin\/access\?limit=25&offset=50$/);
    const updateInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect(updateInit.method).toBe('PATCH');
    expect(new Headers(updateInit.headers).get('X-CSRF-Token')).toBe('csrf-value');
    expect(updateInit.body).toBe(JSON.stringify({ role: 'editor' }));
  });
});