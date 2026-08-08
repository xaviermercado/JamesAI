export const PRODUCTION_ORIGIN = 'https://scouty.ca';

export type RouteIndexing = 'index' | 'noindex';

export interface RoutePolicy {
  path: string;
  title: string;
  description: string;
  indexing: RouteIndexing;
  sitemap: boolean;
}

export const ROUTE_POLICIES: readonly RoutePolicy[] = [
  { path: '/', title: 'Scouty | Movie and TV recommendations', description: 'Find personalized movie and TV recommendations for your mood, occasion, and streaming services.', indexing: 'index', sitemap: true },
  { path: '/about', title: 'About Scouty', description: 'Learn how Scouty helps you choose what to watch.', indexing: 'index', sitemap: true },
  { path: '/contact', title: 'Contact Scouty', description: 'Contact the Scouty team with feedback or questions.', indexing: 'index', sitemap: true },
  { path: '/privacy', title: 'Privacy | Scouty', description: 'Learn how Scouty handles account, recommendation, analytics, and integration data.', indexing: 'index', sitemap: true },
  { path: '/terms', title: 'Terms | Scouty', description: 'Read the terms that apply when using Scouty.', indexing: 'index', sitemap: true },
  { path: '/explore', title: 'Scouty', description: 'Find movie and TV recommendations with Scouty.', indexing: 'noindex', sitemap: false },
  { path: '/login', title: 'Log in | Scouty', description: 'Log in to Scouty.', indexing: 'noindex', sitemap: false },
  { path: '/signup', title: 'Create an account | Scouty', description: 'Create a Scouty account.', indexing: 'noindex', sitemap: false },
  { path: '/forgot-password', title: 'Forgot password | Scouty', description: 'Request a Scouty password reset.', indexing: 'noindex', sitemap: false },
  { path: '/reset-password', title: 'Reset password | Scouty', description: 'Reset your Scouty password.', indexing: 'noindex', sitemap: false },
  { path: '/verify-email', title: 'Verify email | Scouty', description: 'Verify your Scouty email address.', indexing: 'noindex', sitemap: false },
  { path: '/profile', title: 'Profile | Scouty', description: 'Manage your private Scouty profile.', indexing: 'noindex', sitemap: false },
  { path: '/profile/edit', title: 'Edit profile | Scouty', description: 'Manage your private Scouty profile.', indexing: 'noindex', sitemap: false },
  { path: '/profile/library', title: 'Library | Scouty', description: 'View your private Scouty library.', indexing: 'noindex', sitemap: false },
  { path: '/profile/preferences', title: 'Preferences | Scouty', description: 'Manage your private Scouty preferences.', indexing: 'noindex', sitemap: false },
  { path: '/profile/streaming-services', title: 'Streaming services | Scouty', description: 'Manage your private streaming services.', indexing: 'noindex', sitemap: false },
] as const;

const fallbackPolicy: RoutePolicy = {
  path: '/not-found',
  title: 'Page not found | Scouty',
  description: 'The requested Scouty page could not be found.',
  indexing: 'noindex',
  sitemap: false,
};

export function normalizeRoutePath(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || '/';
  if (path === '/') return path;
  return `/${path.split('/').filter(Boolean).join('/')}`;
}

export function getRoutePolicy(pathname: string): RoutePolicy {
  const normalized = normalizeRoutePath(pathname);
  return ROUTE_POLICIES.find((route) => route.path === normalized) ?? fallbackPolicy;
}
