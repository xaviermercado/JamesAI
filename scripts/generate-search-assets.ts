import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PRODUCTION_ORIGIN, ROUTE_POLICIES } from '../src/constants/route-policy';

export function createRobotsTxt(indexingEnabled: boolean): string {
  if (!indexingEnabled) {
    return 'User-agent: *\nDisallow: /\n';
  }

  return `User-agent: *\nAllow: /\n\nSitemap: ${PRODUCTION_ORIGIN}/sitemap.xml\n`;
}

export function createSitemapXml(indexingEnabled: boolean): string {
  const urls = indexingEnabled
    ? ROUTE_POLICIES.filter((route) => route.indexing === 'index' && route.sitemap)
      .map((route) => `  <url><loc>${PRODUCTION_ORIGIN}${route.path === '/' ? '/' : route.path}</loc></url>`)
      .join('\n')
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls ? `\n${urls}\n` : ''}</urlset>\n`;
}

async function main(): Promise<void> {
  const indexingEnabled = process.env.EXPO_PUBLIC_SITE_INDEXING_ENABLED === 'true';
  const publicDirectory = path.resolve(process.cwd(), 'public');
  await mkdir(publicDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(publicDirectory, 'robots.txt'), createRobotsTxt(indexingEnabled), 'utf8'),
    writeFile(path.join(publicDirectory, 'sitemap.xml'), createSitemapXml(indexingEnabled), 'utf8'),
  ]);
}

if (process.argv[1]?.endsWith('generate-search-assets.ts')) {
  void main();
}
