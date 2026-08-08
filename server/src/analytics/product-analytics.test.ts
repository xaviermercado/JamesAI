import { describe, expect, it, vi } from 'vitest';

import { ProductAnalyticsService, type ProductAnalyticsRepositoryLike, type ValidatedProductAnalyticsEvent } from './product-analytics';

class InMemoryRepository implements ProductAnalyticsRepositoryLike {
  events: ValidatedProductAnalyticsEvent[] = [];
  aggregateUtcDay = vi.fn(async () => undefined);
  deleteEventsBefore = vi.fn(async () => 3);
  listDaily = vi.fn(async () => []);
  async insertEvent(event: ValidatedProductAnalyticsEvent) { this.events.push(event); }
}

describe('ProductAnalyticsService', () => {
  it('stores only validated, coarse, non-identifying fields', async () => {
    const repository = new InMemoryRepository();
    const service = new ProductAnalyticsService(repository);
    const recorded = await service.record({
      eventName: 'recommendation_completed',
      recommendationCorrelationId: '0f891af5-800c-4c39-b26e-494b2d950fcc',
      responseStatus: 'success',
      responseTimeBucket: '1_3s',
      resultCountBucket: '6_10',
      mediaType: 'movie',
      authenticated: true,
    }, new Date('2026-08-07T12:34:56.789Z'));
    expect(recorded).toBe(true);
    expect(repository.events[0]).toMatchObject({ occurredAt: new Date('2026-08-07T12:34:00.000Z'), configurationVersionId: null });
    expect(Object.keys(repository.events[0] ?? {})).not.toEqual(expect.arrayContaining(['userId', 'ip', 'userAgent', 'prompt', 'title', 'url', 'error']));
  });

  it('rejects PII, raw prompts, tokens, nested data, and unknown fields', async () => {
    const repository = new InMemoryRepository();
    const service = new ProductAnalyticsService(repository);
    for (const unsafe of [
      { email: 'private@example.com' }, { prompt: 'private search' }, { token: 'secret' },
      { error: { stack: 'private' } }, { userId: 'user-1' }, { url: 'https://scouty.ca/reset?token=x' },
    ]) {
      expect(await service.record({ eventName: 'registration_completed', sourceSurface: 'auth', ...unsafe } as never)).toBe(false);
    }
    expect(repository.events).toHaveLength(0);
  });

  it('requires request-scoped correlation for recommendation events', async () => {
    const repository = new InMemoryRepository();
    const service = new ProductAnalyticsService(repository);
    expect(await service.record({ eventName: 'recommendation_requested', mediaType: 'movie' })).toBe(false);
  });

  it('pins a server-only configuration version on a request-scoped recorder', async () => {
    const repository = new InMemoryRepository();
    const service = new ProductAnalyticsService(repository, 'deployment-default');
    const recorder = service.forConfiguration('configuration-42');

    await recorder.record({
      eventName: 'recommendation_requested',
      recommendationCorrelationId: '0f891af5-800c-4c39-b26e-494b2d950fcc',
      mediaType: 'movie',
    });
    await recorder.record({
      eventName: 'recommendation_completed',
      recommendationCorrelationId: '0f891af5-800c-4c39-b26e-494b2d950fcc',
      responseStatus: 'success',
    });

    expect(repository.events.map((event) => event.configurationVersionId)).toEqual([
      'configuration-42',
      'configuration-42',
    ]);
    expect(await service.record({
      eventName: 'registration_completed',
      configurationVersionId: 'client-controlled',
    } as never)).toBe(false);
  });

  it('runs idempotent aggregation before bounded 90-day retention', async () => {
    const repository = new InMemoryRepository();
    const service = new ProductAnalyticsService(repository);
    await expect(service.runDailyMaintenance('2026-08-06', new Date('2026-08-07T12:00:00Z'))).resolves.toEqual({ deleted: 3 });
    expect(repository.aggregateUtcDay).toHaveBeenCalledWith(new Date('2026-08-06T00:00:00Z'), new Date('2026-08-07T00:00:00Z'));
    expect(repository.deleteEventsBefore).toHaveBeenCalledWith(new Date('2026-05-09T12:00:00Z'), 5000);
  });

  it('rejects invalid or rollover aggregate dates', async () => {
    const service = new ProductAnalyticsService(new InMemoryRepository());
    await expect(service.runDailyMaintenance('2026-02-31')).rejects.toThrow('valid YYYY-MM-DD');
    await expect(service.runDailyMaintenance('02/28/2026')).rejects.toThrow('YYYY-MM-DD');
  });

  it('swallows repository outages', async () => {
    const repository = new InMemoryRepository();
    repository.insertEvent = vi.fn(async () => { throw new Error('database unavailable'); });
    const service = new ProductAnalyticsService(repository);
    await expect(service.record({ eventName: 'registration_completed', sourceSurface: 'auth' })).resolves.toBe(false);
  });
});
