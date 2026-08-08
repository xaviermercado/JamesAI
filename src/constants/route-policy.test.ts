import { describe, expect, it } from 'vitest';

import { getRoutePolicy, PRODUCTION_ORIGIN, ROUTE_POLICIES } from './route-policy';
import { createRobotsTxt, createSitemapXml } from '../../scripts/generate-search-assets';

describe('search visibility policy', () => {
  it('indexes only canonical public content routes', () => {
    const indexed = ROUTE_POLICIES.filter((route) => route.indexing === 'index').map((route) => route.path);
    expect(indexed).toEqual(['/', '/about', '/contact', '/privacy', '/terms']);
    expect(ROUTE_POLICIES.filter((route) => route.sitemap).map((route) => route.path)).toEqual(indexed);
  });

  it('marks authentication, token, and private account routes noindex', () => {
    for (const path of ['/login', '/signup', '/verify-email', '/forgot-password', '/reset-password', '/profile', '/profile/library']) {
      expect(getRoutePolicy(`${path}?token=secret#private`).indexing).toBe('noindex');
    }
    expect(getRoutePolicy('/unknown/private/value')).toMatchObject({ path: '/not-found', indexing: 'noindex', sitemap: false });
  });

  it('keeps every admin route private, out of the sitemap, and excluded from analytics', () => {
    for (const path of ['/admin', '/admin/guidance', '/admin/sandbox', '/admin/versions', '/admin/feedback', '/admin/audit']) {
      expect(getRoutePolicy(`${path}?private=value`)).toMatchObject({ path, indexing: 'noindex', sitemap: false, analytics: false });
    }
  });

  it('generates a production robots file and public-only XML sitemap', () => {
    const robots = createRobotsTxt(true);
    const sitemap = createSitemapXml(true);
    expect(robots).toContain(`Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml`);
    expect(robots).not.toContain('Disallow: /');
    for (const path of ['/', '/about', '/contact', '/privacy', '/terms']) {
      expect(sitemap).toContain(`<loc>${PRODUCTION_ORIGIN}${path}</loc>`);
    }
    for (const path of ['/login', '/signup', '/verify-email', '/reset-password', '/profile']) {
      expect(sitemap).not.toContain(`<loc>${PRODUCTION_ORIGIN}${path}</loc>`);
    }
  });

  it('blocks all crawling in preview or staging output', () => {
    expect(createRobotsTxt(false)).toBe('User-agent: *\nDisallow: /\n');
    expect(createSitemapXml(false)).not.toContain('<url>');
  });
});
