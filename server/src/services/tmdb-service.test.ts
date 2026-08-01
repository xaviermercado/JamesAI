import { describe, expect, it, vi } from 'vitest';

import { TmdbService } from './tmdb-service';

const fetchMock = vi.fn();

global.fetch = fetchMock as unknown as typeof fetch;

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
});
