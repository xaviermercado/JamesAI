import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TmdbService } from './tmdb-service';

const fetchMock = vi.fn();

global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  fetchMock.mockReset();
});

describe('TmdbService', () => {
  it('returns normalized recommendations from TMDB responses', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ id: 123, title: 'Example Movie', poster_path: '/poster.jpg', release_date: '2023-10-01', vote_average: 7.8, genre_ids: [35] }] }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 123, title: 'Example Movie', runtime: 102, genres: [{ id: 35, name: 'Comedy' }], vote_average: 7.8, release_date: '2023-10-01', poster_path: '/poster.jpg' }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: { US: { flatrate: [{ provider_name: 'Netflix' }] } } }),
    });

    const service = new TmdbService({ apiToken: 'test-token', baseUrl: 'https://api.themoviedb.org/3', timeoutMs: 1000 });
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

  it('uses description cues to shape TMDB discover filters', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const service = new TmdbService({ apiToken: 'test-token', baseUrl: 'https://api.themoviedb.org/3', timeoutMs: 1000 });
    await service.getRecommendations({ description: 'funny date night from the 90s', mediaType: 'movie', maxRuntime: 120, country: 'US' });

    const discoverUrl = fetchMock.mock.calls[0][0] as string;
    const search = new URL(discoverUrl).searchParams;
    expect(search.get('with_genres')).toContain('35');
    expect(search.get('primary_release_date.gte')).toBe('1990-01-01');
    expect(search.get('primary_release_date.lte')).toBe('1999-12-31');
  });
});
