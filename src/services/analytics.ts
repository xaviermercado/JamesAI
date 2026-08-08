import { getRoutePolicy } from '../constants/route-policy';

export type AnalyticsConsent = 'unset' | 'accepted' | 'declined';
export type MediaTypeCategory = 'movie' | 'tv' | 'any';
export type CountBucket = '0' | '1' | '2_3' | '4_plus';
export type ResultCountBucket = '0' | '1_5' | '6_10' | '11_20' | '21_plus';
export type ResponseTimeBucket = 'under_1s' | '1_3s' | '3_10s' | 'over_10s';

export interface AnalyticsEventMap {
  page_view: { route: string; page_title: string };
  search: { media_type: MediaTypeCategory; genre_count: CountBucket; provider_count: CountBucket; language_count: CountBucket; authenticated: boolean };
  recommendations_viewed: { result_count_bucket: ResultCountBucket; response_time_bucket: ResponseTimeBucket };
  recommendation_opened: { position_bucket: CountBucket; media_type: Exclude<MediaTypeCategory, 'any'> };
  filter_applied: { filter_category: 'media_type' | 'runtime' | 'market' | 'provider' | 'language'; selected_count_bucket: CountBucket };
  watchlist_added: { media_type: Exclude<MediaTypeCategory, 'any'>; source_surface: 'recommendations' | 'library' };
  feedback_submitted: { feedback_category: 'positive' | 'negative' };
  sign_up: { method: 'email' };
  login: { method: 'email' };
  contact_submitted: { response_status: 'success' };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

export interface AnalyticsTransport {
  initialize(measurementId: string): Promise<void>;
  send<TName extends AnalyticsEventName>(name: TName, parameters: AnalyticsEventMap[TName]): void;
  disable(measurementId: string): void;
}

export interface AnalyticsEnvironment {
  enabled?: string;
  measurementId?: string;
  nodeEnv?: string;
}

interface AnalyticsConfiguration {
  enabled: boolean;
  measurementId: string | null;
}

type SafeParameters = Record<string, string | boolean | number>;

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{6,20}$/;
const EVENT_PARAMETER_KEYS: { [TName in AnalyticsEventName]: readonly (keyof AnalyticsEventMap[TName])[] } = {
  page_view: ['route', 'page_title'],
  search: ['media_type', 'genre_count', 'provider_count', 'language_count', 'authenticated'],
  recommendations_viewed: ['result_count_bucket', 'response_time_bucket'],
  recommendation_opened: ['position_bucket', 'media_type'],
  filter_applied: ['filter_category', 'selected_count_bucket'],
  watchlist_added: ['media_type', 'source_surface'],
  feedback_submitted: ['feedback_category'],
  sign_up: ['method'],
  login: ['method'],
  contact_submitted: ['response_status'],
};

const ENUM_VALUES: Partial<Record<string, readonly string[]>> = {
  media_type: ['movie', 'tv', 'any'],
  genre_count: ['0', '1', '2_3', '4_plus'],
  provider_count: ['0', '1', '2_3', '4_plus'],
  language_count: ['0', '1', '2_3', '4_plus'],
  result_count_bucket: ['0', '1_5', '6_10', '11_20', '21_plus'],
  response_time_bucket: ['under_1s', '1_3s', '3_10s', 'over_10s'],
  position_bucket: ['0', '1', '2_3', '4_plus'],
  filter_category: ['media_type', 'runtime', 'market', 'provider', 'language'],
  selected_count_bucket: ['0', '1', '2_3', '4_plus'],
  source_surface: ['recommendations', 'library'],
  feedback_category: ['positive', 'negative'],
  method: ['email'],
  response_status: ['success'],
};

export function resolveAnalyticsConfiguration(environment: AnalyticsEnvironment): AnalyticsConfiguration {
  const measurementId = environment.measurementId?.trim() ?? '';
  return {
    enabled: environment.nodeEnv === 'production' && environment.enabled === 'true' && MEASUREMENT_ID_PATTERN.test(measurementId),
    measurementId: MEASUREMENT_ID_PATTERN.test(measurementId) ? measurementId : null,
  };
}

function validateParameters<TName extends AnalyticsEventName>(name: TName, value: unknown): AnalyticsEventMap[TName] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const allowedKeys = EVENT_PARAMETER_KEYS[name] as readonly string[];
  if (!allowedKeys) return null;
  if (Object.keys(record).length !== allowedKeys.length || Object.keys(record).some((key) => !allowedKeys.includes(key))) return null;

  for (const key of allowedKeys) {
    const parameter = record[key];
    if (parameter === undefined || parameter === null || typeof parameter === 'object') return null;
    if (key === 'authenticated' && typeof parameter !== 'boolean') return null;
    if (key !== 'authenticated' && typeof parameter !== 'string') return null;
    if (typeof parameter === 'string' && (parameter.length === 0 || parameter.length > 100)) return null;
    const allowedValues = ENUM_VALUES[key];
    if (allowedValues && !allowedValues.includes(parameter as string)) return null;
  }

  if (name === 'page_view') {
    const policy = getRoutePolicy(String(record.route));
    if (policy.path !== record.route || policy.title !== record.page_title || policy.path === '/not-found') return null;
  }

  return record as AnalyticsEventMap[TName];
}

export class AnalyticsClient {
  private consent: AnalyticsConsent = 'unset';
  private initialized = false;
  private initialization: Promise<void> | null = null;
  private lastPagePath: string | null = null;

  constructor(
    private readonly configuration: AnalyticsConfiguration,
    private readonly transport: AnalyticsTransport,
  ) {}

  setConsent(consent: AnalyticsConsent): void {
    this.consent = consent;
    if (consent !== 'accepted') {
      this.transport.disable(this.configuration.measurementId ?? '');
      this.initialized = false;
      this.initialization = null;
      this.lastPagePath = null;
    }
  }

  async enable(): Promise<boolean> {
    if (this.consent !== 'accepted' || !this.configuration.enabled || !this.configuration.measurementId) return false;
    if (this.initialized) return true;
    if (!this.initialization) {
      this.initialization = this.transport.initialize(this.configuration.measurementId)
        .then(() => { this.initialized = true; })
        .catch(() => { this.initialized = false; })
        .finally(() => { this.initialization = null; });
    }
    await this.initialization;
    return this.initialized;
  }

  track<TName extends AnalyticsEventName>(name: TName, parameters: AnalyticsEventMap[TName]): boolean {
    if (this.consent !== 'accepted' || !this.initialized) return false;
    const safeParameters = validateParameters(name, parameters);
    if (!safeParameters) return false;
    try {
      this.transport.send(name, safeParameters);
      return true;
    } catch {
      return false;
    }
  }

  trackPageView(pathname: string): boolean {
    const policy = getRoutePolicy(pathname);
    if (policy.path === '/not-found' || this.lastPagePath === policy.path) return false;
    const sent = this.track('page_view', { route: policy.path, page_title: policy.title });
    if (sent) this.lastPagePath = policy.path;
    return sent;
  }
}

function deleteGoogleAnalyticsCookies(): void {
  if (typeof document === 'undefined') return;
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=', 1)[0]?.trim();
    if (name === '_ga' || name?.startsWith('_ga_')) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.scouty.ca; SameSite=Lax`;
    }
  }
}

class BrowserGtagTransport implements AnalyticsTransport {
  async initialize(measurementId: string): Promise<void> {
    if (typeof window === 'undefined' || typeof document === 'undefined') throw new Error('Analytics requires a browser');
    const analyticsWindow = window as typeof window & { dataLayer?: unknown[][]; gtag?: (...args: unknown[]) => void };
    if (!analyticsWindow.gtag) {
      analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];
      analyticsWindow.gtag = (...args: unknown[]) => { analyticsWindow.dataLayer?.push(args); };
    }
    analyticsWindow.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    analyticsWindow.gtag('consent', 'update', { analytics_storage: 'granted' });
    analyticsWindow.gtag('js', new Date());
    analyticsWindow.gtag('config', measurementId, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });

    if (!document.querySelector(`script[data-scouty-ga="${measurementId}"]`)) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
      script.dataset.scoutyGa = measurementId;
      document.head.appendChild(script);
    }
  }

  send<TName extends AnalyticsEventName>(name: TName, parameters: AnalyticsEventMap[TName]): void {
    const analyticsWindow = window as typeof window & { gtag?: (...args: unknown[]) => void };
    analyticsWindow.gtag?.('event', name, parameters as SafeParameters);
  }

  disable(measurementId: string): void {
    if (typeof window !== 'undefined') {
      const analyticsWindow = window as typeof window & { gtag?: (...args: unknown[]) => void; [key: string]: unknown };
      analyticsWindow.gtag?.('consent', 'update', { analytics_storage: 'denied' });
      if (measurementId) analyticsWindow[`ga-disable-${measurementId}`] = true;
    }
    deleteGoogleAnalyticsCookies();
  }
}

export const analytics = new AnalyticsClient(
  resolveAnalyticsConfiguration({
    enabled: process.env.EXPO_PUBLIC_ANALYTICS_ENABLED,
    measurementId: process.env.EXPO_PUBLIC_GOOGLE_ANALYTICS_ID,
    nodeEnv: process.env.NODE_ENV,
  }),
  new BrowserGtagTransport(),
);

export function countBucket(count: number): CountBucket {
  if (count <= 0) return '0';
  if (count === 1) return '1';
  if (count <= 3) return '2_3';
  return '4_plus';
}

export function resultCountBucket(count: number): ResultCountBucket {
  if (count <= 0) return '0';
  if (count <= 5) return '1_5';
  if (count <= 10) return '6_10';
  if (count <= 20) return '11_20';
  return '21_plus';
}

export function responseTimeBucket(durationMs: number): ResponseTimeBucket {
  if (durationMs < 1000) return 'under_1s';
  if (durationMs < 3000) return '1_3s';
  if (durationMs < 10000) return '3_10s';
  return 'over_10s';
}
