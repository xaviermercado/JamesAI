import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TmdbService } from './tmdb-service';

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const emptyDiscover = { ok: true, json: async () => ({ results: [] }) };
const emptyProviders = { ok: true, json: async () => ({ results: {} }) };

beforeEach(() => {
  fetchMock.mockReset();
});

describe('TmdbService', () => {
  it('returns normalized recommendations from TMDB responses', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ id: 123, title: 'Example Movie', poster_path: '/poster.jpg', release_date: '2023-10-01', vote_average: 7.8, genre_ids: [35] }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 123, title: 'Example Movie', runtime: 102, genres: [{ id: 35, name: 'Comedy' }], vote_average: 7.8, release_date: '2023-10-01', poster_path: '/poster.jpg' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: { US: { flatrate: [{ provider_name: 'Netflix', provider_id: 8 }] } } }) });

    const service = new TmdbService({ apiToken: 'test', baseUrl: 'https://api.themoviedb.org/3', timeoutMs: 1000 });
    const result = await service.getRecommendations({ description: 'funny date night', mediaType: 'movie', maxRuntime: 120, country: 'US' });

    expect(result.source).toBe('live');
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]).toMatchObject({
      title: 'Example Movie',
      tmdbMovieId: 123,
      mediaType: 'movie',
      providers: ['Netflix'],
    });
  });

  it('applies year range from description to discover params', async () => {
    fetchMock.mockResolvedValue(emptyDiscover);

    const service = new TmdbService({ apiToken: 'test', baseUrl: 'https://api.themoviedb.org/3', timeoutMs: 1000 });
    await service.getRecommendations({ description: 'funny date night from the 90s', mediaType: 'movie', country: 'US' });

    const call = fetchMock.mock.calls.find((args: unknown[]) => (args[0] as string).includes('/discover/')) as unknown[] | undefined;
    expect(call).toBeDefined();
    const params = new URL(call![0] as string).searchParams;
    expect(params.get('primary_release_date.gte')).toBe('1990-01-01');
    expect(params.get('primary_release_date.lte')).toBe('1999-12-31');
  });

  it('applies provider IDs directly to discover params', async () => {
    fetchMock.mockResolvedValue(emptyDiscover);

    const service = new TmdbService({ apiToken: 'test', baseUrl: 'https://api.themoviedb.org/3', timeoutMs: 1000 });
    await service.getRecommendations({ description: 'drama', country: 'CA', providerIds: [8, 230] });

    const call = fetchMock.mock.calls.find((args: unknown[]) => (args[0] as string).includes('/discover/')) as unknown[] | undefined;
    const params = new URL(call![0] as string).searchParams;
    expect(params.get('with_watch_providers')).toBe('8|230');
    expect(params.get('watch_region')).toBe('CA');
  });

  it('applies original language to discover params', async () => {
    fetchMock.mockResolvedValue(emptyDiscover);

    const service = new TmdbService({ apiToken: 'test', baseUrl: 'https://api.themoviedb.org/3', timeoutMs: 1000 });
    await service.getRecommendations({ description: 'drama', originalLanguages: ['fr'] });

    const call = fetchMock.mock.calls.find((args: unknown[]) => (args[0] as string).includes('/discover/')) as unknown[] | undefined;
    const params = new URL(call![0] as string).searchParams;
    expect(params.get('with_original_language')).toBe('fr');
  });

  it('uses first language in priority list for discover filter', async () => {
    fetchMock.mockResolvedValue(emptyDiscover);

    const service = new TmdbService({ apiToken: 'test', baseUrl: 'https://api.themoviedb.org/3', timeoutMs: 1000 });
    await service.getRecommendations({ description: 'drama', originalLanguages: ['fr', 'en', 'ja'] });

    const call = fetchMock.mock.calls.find((args: unknown[]) => (args[0] as string).includes('/discover/')) as unknown[] | undefined;
    const params = new URL(call![0] as string).searchParams;
    // Only the primary (first) language is applied to discover
    expect(params.get('with_original_language')).toBe('fr');
  });

  it('falls back to legacy name-based provider lookup when providerIds absent', async () => {
    fetchMock.mockResolvedValue(emptyDiscover);

    const service = new TmdbService({ apiToken: 'test', baseUrl: 'https://api.themoviedb.org/3', timeoutMs: 1000 });
    await service.getRecommendations({ description: 'drama', streamingServices: ['Netflix'], country: 'US' });

    const call = fetchMock.mock.calls.find((args: unknown[]) => (args[0] as string).includes('/discover/')) as unknown[] | undefined;
    const params = new URL(call![0] as string).searchParams;
    expect(params.get('with_watch_providers')).toBe('8'); // Netflix = 8
  });

  it('runs relaxed discover when constrained result is too small', async () => {
    // Return 0 results initially (constrained), then 1 result for relaxed discover.
    fetchMock
      .mockResolvedValueOnce(emptyDiscover) // constrained broad discover
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ id: 42, title: 'Fallback', release_date: '2020-01-01', vote_average: 6.0 }] }) }) // relaxed discover
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 42, title: 'Fallback', runtime: 90, genres: [], vote_average: 6.0, release_date: '2020-01-01' }) }) // details
      .mockResolvedValueOnce(emptyProviders); // providers

    const service = new TmdbService({ apiToken: 'test', baseUrl: 'https://api.themoviedb.org/3', timeoutMs: 1000 });
    const result = await service.getRecommendations({ description: 'drama', providerIds: [8], originalLanguages: ['ko'] });

    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('only returns subscription (flatrate) providers, not rental/purchase', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ id: 99, title: 'Test', release_date: '2022-01-01', vote_average: 7.0 }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 99, title: 'Test', runtime: 90, genres: [], vote_average: 7.0, release_date: '2022-01-01' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            US: {
              flatrate: [{ provider_name: 'Netflix', provider_id: 8 }],
              rent: [{ provider_name: 'Amazon', provider_id: 9 }],
              buy: [{ provider_name: 'Apple TV', provider_id: 2 }],
            },
          },
        }),
      });

    const service = new TmdbService({ apiToken: 'test', baseUrl: 'https://api.themoviedb.org/3', timeoutMs: 1000 });
    const result = await service.getRecommendations({ description: 'drama', country: 'US' });

    expect(result.recommendations[0]?.providers).toEqual(['Netflix']);
    expect(result.recommendations[0]?.providers).not.toContain('Amazon');
    expect(result.recommendations[0]?.providers).not.toContain('Apple TV');
  });

  it('handles provider lookup failure gracefully — still returns candidate', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ id: 7, title: 'X', release_date: '2021-01-01', vote_average: 6.5 }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 7, title: 'X', runtime: 90, genres: [], vote_average: 6.5, release_date: '2021-01-01' }) })
      .mockRejectedValueOnce(new Error('Provider lookup failed'));

    const service = new TmdbService({ apiToken: 'test', baseUrl: 'https://api.themoviedb.org/3', timeoutMs: 1000 });
    const result = await service.getRecommendations({ description: 'drama', country: 'US' });

    expect(result.recommendations[0]).toBeDefined();
    expect(result.recommendations[0]?.providers).toEqual([]);
  });
});
