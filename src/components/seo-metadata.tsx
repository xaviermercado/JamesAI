import { usePathname } from 'expo-router';
import Head from 'expo-router/head';

import { getRoutePolicy, PRODUCTION_ORIGIN } from '@/constants/route-policy';

export function SeoMetadata() {
  const policy = getRoutePolicy(usePathname());
  const canonicalUrl = `${PRODUCTION_ORIGIN}${policy.path === '/' ? '' : policy.path}`;

  return (
    <Head>
      <title>{policy.title}</title>
      <meta name="description" content={policy.description} />
      <meta name="robots" content={policy.indexing === 'index' ? 'index,follow' : 'noindex,nofollow,noarchive'} />
      <link rel="canonical" href={canonicalUrl} />
      {policy.indexing === 'index' ? (
        <>
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="Scouty" />
          <meta property="og:title" content={policy.title} />
          <meta property="og:description" content={policy.description} />
          <meta property="og:url" content={canonicalUrl} />
        </>
      ) : null}
    </Head>
  );
}
