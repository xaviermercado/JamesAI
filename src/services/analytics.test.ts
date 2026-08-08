import { describe, expect, it, vi } from 'vitest';

import {
  AnalyticsClient,
  resolveAnalyticsConfiguration,
  type AnalyticsEventMap,
  type AnalyticsEventName,
  type AnalyticsTransport,
} from './analytics';

class FakeTransport implements AnalyticsTransport {
  initialize = vi.fn(async () => undefined);
  disable = vi.fn();
  events: { name: AnalyticsEventName; parameters: AnalyticsEventMap[AnalyticsEventName] }[] = [];

  send<TName extends AnalyticsEventName>(name: TName, parameters: AnalyticsEventMap[TName]): void {
    this.events.push({ name, parameters });
  }
}

function createEnabledClient(transport = new FakeTransport()) {
  return {
    client: new AnalyticsClient(resolveAnalyticsConfiguration({
      enabled: 'true',
      measurementId: 'G-TEST123456',
      nodeEnv: 'production',
    }), transport),
    transport,
  };
}

describe('analytics configuration', () => {
  it('is disabled by default outside explicitly enabled production', () => {
    expect(resolveAnalyticsConfiguration({ nodeEnv: 'production', measurementId: 'G-TEST123456' }).enabled).toBe(false);
    expect(resolveAnalyticsConfiguration({ nodeEnv: 'development', enabled: 'true', measurementId: 'G-TEST123456' }).enabled).toBe(false);
    expect(resolveAnalyticsConfiguration({ nodeEnv: 'production', enabled: 'true', measurementId: 'invalid' }).enabled).toBe(false);
  });
});

describe('AnalyticsClient', () => {
  it('does not initialize or send before consent', async () => {
    const { client, transport } = createEnabledClient();
    expect(await client.enable()).toBe(false);
    expect(client.track('login', { method: 'email' })).toBe(false);
    expect(transport.initialize).not.toHaveBeenCalled();
    expect(transport.events).toHaveLength(0);
  });

  it('initializes once and deduplicates route views', async () => {
    const { client, transport } = createEnabledClient();
    client.setConsent('accepted');
    await Promise.all([client.enable(), client.enable()]);
    expect(transport.initialize).toHaveBeenCalledTimes(1);
    expect(client.trackPageView('/about?email=private@example.com#token')).toBe(true);
    expect(client.trackPageView('/about')).toBe(false);
    expect(transport.events).toEqual([{ name: 'page_view', parameters: { route: '/about', page_title: 'About Scouty' } }]);
  });

  it('stops collection after withdrawal', async () => {
    const { client, transport } = createEnabledClient();
    client.setConsent('accepted');
    await client.enable();
    expect(client.track('login', { method: 'email' })).toBe(true);
    client.setConsent('declined');
    expect(client.track('login', { method: 'email' })).toBe(false);
    expect(transport.disable).toHaveBeenLastCalledWith('G-TEST123456');
    expect(transport.events).toHaveLength(1);
  });

  it('rejects unknown, nested, missing, and unsafe parameters', async () => {
    const { client, transport } = createEnabledClient();
    client.setConsent('accepted');
    await client.enable();

    const unsafePayloads: unknown[] = [
      { method: 'email', email: 'private@example.com' },
      { method: { nested: 'email' } },
      { method: undefined },
      { route: 'https://scouty.ca/reset-password?token=secret', page_title: 'Reset' },
      { route: '/about', page_title: 'private@example.com' },
    ];

    for (const payload of unsafePayloads) {
      expect(client.track('login', payload as AnalyticsEventMap['login'])).toBe(false);
    }
    expect(client.track('unknown_event' as AnalyticsEventName, { email: 'private@example.com' } as never)).toBe(false);
    expect(transport.events).toHaveLength(0);
  });

  it('cannot break a workflow when transport dispatch fails', async () => {
    const transport = new FakeTransport();
    transport.send = () => { throw new Error('blocked'); };
    const { client } = createEnabledClient(transport);
    client.setConsent('accepted');
    await client.enable();
    expect(() => client.track('contact_submitted', { response_status: 'success' })).not.toThrow();
    expect(client.track('contact_submitted', { response_status: 'success' })).toBe(false);
  });
});
