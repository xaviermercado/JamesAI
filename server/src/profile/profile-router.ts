import type { Request, Response } from 'express';
import express from 'express';
import { z } from 'zod';

import type { AppConfig } from '../config/env';
import { getSessionTokenFromRequest } from '../auth/auth-request';
import { AuthService } from '../auth/auth-service';
import { AUTH_CSRF_HEADER_NAME, createCsrfToken, timingSafeStringEqual } from '../auth/auth-crypto';
import type { AuthRepositoryLike } from '../auth/auth-repository';
import { streamingServiceCatalog, updateContentLanguagesSchema, updatePreferencesSchema, updateProfileSchema, updateStreamingServicesSchema } from './profile-schemas';
import type { LetterboxdRepositoryLike, StoredLetterboxdSettings } from '../letterboxd/letterboxd-repository';
import { fetchAndParseLetterboxdRss } from '../letterboxd/letterboxd-rss';
import { classifyFailure, type ProductAnalyticsService } from '../analytics/product-analytics';
import { scoutyAvatarCatalog } from './avatar-catalog';
import { normalizeProfileUsername } from './profile-usernames';
import type { ProfileRepositoryLike } from './profile-repository';
import { resolveServiceSelections, toApiProfile } from './profile-repository';
import {
  countryCatalog,
  findIncompatibleProvidersForCountry,
  getCountryAwareProviderCatalog,
  languageCatalog,
} from './reference-data';
import { logger } from '../utils/logger';

function buildDisplayName(firstName: string, lastName: string, displayName: string | null | undefined): string {
  const explicit = displayName?.trim();
  if (explicit) {
    return explicit;
  }

  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

function getCsrfTokenFromRequest(req: Request): string | null {
  const header = req.get(AUTH_CSRF_HEADER_NAME);
  return header?.trim() || null;
}

function isAllowedOrigin(origin: string | undefined, config: AppConfig): boolean {
  if (!origin || !config.frontendOrigin) {
    return true;
  }

  return origin === config.frontendOrigin;
}

function requireCsrf(req: Request, res: Response, sessionTokenHash: string, config: AppConfig): boolean {
  const csrfToken = getCsrfTokenFromRequest(req);
  if (!csrfToken) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }

  const expectedToken = createCsrfToken(sessionTokenHash, config.sessionTokenPepper ?? '');
  if (!timingSafeStringEqual(expectedToken, csrfToken)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }

  return true;
}

function logProfileRouteError(route: string, req: Request, error: unknown): void {
  logger.error('profile.route_error', {
    route,
    method: req.method,
    path: req.path,
    error,
  });
}

function toProviderIdSet(items: Array<{ providerId: number }>): Set<number> {
  return new Set(items.map((item) => item.providerId));
}

const updateLetterboxdSettingsSchema = z.object({
  publicActivityEnabled: z.boolean(),
}).strict();

function toIso(value: Date | null | undefined): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

function toLetterboxdStatusPayload(
  settings: StoredLetterboxdSettings | null,
  counts: { rssCount: number; exportCount: number },
  username: string | null,
) {
  return {
    enabled: settings?.public_activity_enabled === 1,
    rssStatus: settings?.rss_status ?? 'idle',
    lastCheckedAt: toIso(settings?.rss_last_checked_at),
    lastSuccessfulRefreshAt: toIso(settings?.rss_last_success_at),
    lastErrorCode: settings?.rss_last_error_code ?? null,
    lastErrorMessage: settings?.rss_last_error_message ?? null,
    rssCount: counts.rssCount,
    exportCount: counts.exportCount,
    username,
  };
}

export function createProfileRouter(
  config: AppConfig,
  authRepository: AuthRepositoryLike,
  profileRepository: ProfileRepositoryLike,
  letterboxdRepository?: LetterboxdRepositoryLike | null,
  productAnalytics?: ProductAnalyticsService | null,
) {
  const router = express.Router();
  const authService = new AuthService(authRepository, config);

  router.use((req, res, next) => {
    if (req.path !== '/reference' && req.path !== '/providers') {
      res.setHeader('Cache-Control', 'private, no-store');
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !isAllowedOrigin(req.headers.origin, config)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  });

  // Public reference data: countries and language catalogs (no auth required).
  router.get('/reference', (_req, res) => {
    return res.json({
      countries: countryCatalog,
      languages: languageCatalog,
      providers: streamingServiceCatalog,
      avatars: scoutyAvatarCatalog,
    });
  });

  router.get('/providers', async (req, res) => {
    const country = typeof req.query.country === 'string' ? req.query.country.trim().toUpperCase() : 'US';
    const catalog = getCountryAwareProviderCatalog(country);
    return res.json(catalog);
  });

  router.get('/', async (req, res) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const profile = await profileRepository.findByUserId(restored.identity.userId);
      return res.json({ profile: profile ? toApiProfile(profile) : null });
    } catch (error) {
      logProfileRouteError('/', req, error);
      return res.status(500).json({ error: 'Unable to load profile right now' });
    }
  });

  router.patch('/', async (req, res) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!requireCsrf(req, res, restored.identity.sessionTokenHash, config)) {
        return undefined;
      }

      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid profile payload' });
      }

      const letterboxdUsername = normalizeProfileUsername('letterboxd', parsed.data.letterboxdUsername);
      const tvtimeUsername = normalizeProfileUsername('tvtime', parsed.data.tvtimeUsername);

      const saved = await profileRepository.upsert(restored.identity.userId, {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        displayName: buildDisplayName(parsed.data.firstName, parsed.data.lastName, parsed.data.displayName),
        countryCode: parsed.data.countryCode,
        viewingFormatPreference: parsed.data.viewingFormatPreference ?? null,
        avatarId: parsed.data.avatarId ?? null,
        letterboxdUsername,
        tvtimeUsername,
      });

      return res.json({ profile: toApiProfile(saved) });
    } catch (error) {
      logProfileRouteError('/', req, error);
      return res.status(500).json({ error: 'Unable to save profile right now' });
    }
  });

  // Streaming services (legacy individual endpoint, preserved for backward compatibility).
  router.get('/streaming-services', async (req, res) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const services = await profileRepository.listStreamingServices(restored.identity.userId);
      return res.json({ services, catalog: streamingServiceCatalog });
    } catch (error) {
      logProfileRouteError('/streaming-services', req, error);
      return res.status(500).json({ error: 'Unable to load streaming services right now' });
    }
  });

  router.patch('/streaming-services', async (req, res) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!requireCsrf(req, res, restored.identity.sessionTokenHash, config)) {
        return undefined;
      }

      const parsed = updateStreamingServicesSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      }

      const profile = await profileRepository.findByUserId(restored.identity.userId);
      const serviceSelections = resolveServiceSelections(parsed.data.providerIds);

      const services = await profileRepository.replaceStreamingServices(
        restored.identity.userId,
        profile?.country_code ?? 'US',
        serviceSelections,
      );

      return res.json({ services, catalog: streamingServiceCatalog });
    } catch (error) {
      logProfileRouteError('/streaming-services', req, error);
      return res.status(500).json({ error: 'Unable to save streaming services right now' });
    }
  });

  // Content languages.
  router.get('/content-languages', async (req, res) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const languages = await profileRepository.listContentLanguages(restored.identity.userId);
      return res.json({ languages });
    } catch (error) {
      logProfileRouteError('/content-languages', req, error);
      return res.status(500).json({ error: 'Unable to load content language preferences right now' });
    }
  });

  router.patch('/content-languages', async (req, res) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!requireCsrf(req, res, restored.identity.sessionTokenHash, config)) {
        return undefined;
      }

      const parsed = updateContentLanguagesSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      }

      const languages = await profileRepository.replaceContentLanguages(restored.identity.userId, parsed.data.languageCodes);
      return res.json({ languages });
    } catch (error) {
      logProfileRouteError('/content-languages', req, error);
      return res.status(500).json({ error: 'Unable to save content language preferences right now' });
    }
  });

  // Atomic preferences: market + streaming services + content languages + viewing format.
  router.get('/preferences', async (req, res) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { userId } = restored.identity;
      const [profile, services, languages] = await Promise.all([
        profileRepository.findByUserId(userId),
        profileRepository.listStreamingServices(userId),
        profileRepository.listContentLanguages(userId),
      ]);

      const effectiveMarket = profile?.country_code ?? 'US';
      const providerCatalog = getCountryAwareProviderCatalog(effectiveMarket);

      return res.json({
        marketCode: profile?.country_code ?? null,
        viewingFormatPreference: profile?.viewing_format_preference ?? null,
        personalizationEnabled: profile ? profile.personalization_enabled !== 0 : true,
        streamingServices: services,
        contentLanguages: languages,
        catalog: {
          providers: providerCatalog.providers,
          countries: countryCatalog,
          languages: languageCatalog,
          avatars: scoutyAvatarCatalog,
        },
        providerCatalogAvailabilityKnown: providerCatalog.availabilityKnown,
      });
    } catch (error) {
      logProfileRouteError('/preferences', req, error);
      return res.status(500).json({ error: 'Unable to load preferences right now' });
    }
  });

  router.patch('/preferences', async (req, res) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!requireCsrf(req, res, restored.identity.sessionTokenHash, config)) {
        return undefined;
      }

      const parsed = updatePreferencesSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      }

      const { userId } = restored.identity;

      const existingServices = await profileRepository.listStreamingServices(userId);
      const existingProviderIds = toProviderIdSet(existingServices);
      const requestedProviderIds = [...parsed.data.providerIds];

      const incompatibleRequested = findIncompatibleProvidersForCountry(parsed.data.marketCode, requestedProviderIds);
      const incompatibleExisting = findIncompatibleProvidersForCountry(
        parsed.data.marketCode,
        [...existingProviderIds],
      );

      let effectiveProviderIds = requestedProviderIds;
      if (parsed.data.allowProviderPrune && incompatibleRequested.length > 0) {
        const incompatibleSet = new Set(incompatibleRequested);
        effectiveProviderIds = requestedProviderIds.filter((providerId) => !incompatibleSet.has(providerId));
      }

      const serviceSelections = resolveServiceSelections(effectiveProviderIds);

      await profileRepository.replacePreferences(userId, {
        marketCode: parsed.data.marketCode,
        viewingFormatPreference: parsed.data.viewingFormatPreference,
        personalizationEnabled: parsed.data.personalizationEnabled,
        services: serviceSelections,
        languageCodes: parsed.data.languageCodes,
      });

      const [profile, services, languages] = await Promise.all([
        profileRepository.findByUserId(userId),
        profileRepository.listStreamingServices(userId),
        profileRepository.listContentLanguages(userId),
      ]);

      return res.json({
        marketCode: profile?.country_code ?? parsed.data.marketCode,
        viewingFormatPreference: profile?.viewing_format_preference ?? null,
        personalizationEnabled: profile ? profile.personalization_enabled !== 0 : (parsed.data.personalizationEnabled ?? true),
        streamingServices: services,
        contentLanguages: languages,
        countryProviderCompatibility: {
          availabilityKnown: getCountryAwareProviderCatalog(parsed.data.marketCode).availabilityKnown,
          incompatibleRequestedProviderIds: incompatibleRequested,
          removedProviderIds: parsed.data.allowProviderPrune ? incompatibleRequested : [],
          incompatibleExistingProviderIds: incompatibleExisting,
        },
      });
    } catch (error) {
      logProfileRouteError('/preferences', req, error);
      return res.status(500).json({ error: 'Unable to save preferences right now' });
    }
  });

  router.get('/letterboxd/status', async (req, res) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!letterboxdRepository) {
      return res.status(503).json({ error: 'Letterboxd features are not available right now' });
    }

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { userId } = restored.identity;
      const [profile, settings, counts] = await Promise.all([
        profileRepository.findByUserId(userId),
        letterboxdRepository.getSettings(userId),
        letterboxdRepository.countTitlesBySource(userId),
      ]);

      return res.json({
        status: toLetterboxdStatusPayload(settings, counts, profile?.letterboxd_username ?? null),
      });
    } catch (error) {
      logProfileRouteError('/letterboxd/status', req, error);
      return res.status(500).json({ error: 'Unable to load Letterboxd status right now' });
    }
  });

  router.patch('/letterboxd/settings', async (req, res) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!letterboxdRepository) {
      return res.status(503).json({ error: 'Letterboxd features are not available right now' });
    }

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!requireCsrf(req, res, restored.identity.sessionTokenHash, config)) {
        return undefined;
      }

      const parsed = updateLetterboxdSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      }

      const { userId } = restored.identity;
      await letterboxdRepository.setPublicActivityEnabled(userId, parsed.data.publicActivityEnabled);

      const [profile, settings, counts] = await Promise.all([
        profileRepository.findByUserId(userId),
        letterboxdRepository.getSettings(userId),
        letterboxdRepository.countTitlesBySource(userId),
      ]);

      return res.json({
        status: toLetterboxdStatusPayload(settings, counts, profile?.letterboxd_username ?? null),
      });
    } catch (error) {
      logProfileRouteError('/letterboxd/settings', req, error);
      return res.status(500).json({ error: 'Unable to update Letterboxd settings right now' });
    }
  });

  router.post('/letterboxd/refresh', async (req, res) => {
    const sessionToken = getSessionTokenFromRequest(req);
    if (!sessionToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!letterboxdRepository) {
      return res.status(503).json({ error: 'Letterboxd features are not available right now' });
    }

    try {
      const restored = await authService.restoreSession(sessionToken);
      if (!restored.authenticated || !restored.identity) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!requireCsrf(req, res, restored.identity.sessionTokenHash, config)) {
        return undefined;
      }

      const { userId } = restored.identity;
      const [profile, settings] = await Promise.all([
        profileRepository.findByUserId(userId),
        letterboxdRepository.getSettings(userId),
      ]);

      const username = profile?.letterboxd_username ?? null;
      if (!username) {
        return res.status(400).json({ error: 'Add a Letterboxd username to your profile first' });
      }
      if (settings?.public_activity_enabled !== 1) {
        return res.status(409).json({ error: 'Enable public activity sync before refreshing' });
      }

      const rssResult = await fetchAndParseLetterboxdRss(username, {
        etag: settings?.rss_etag ?? null,
        lastModified: settings?.rss_last_modified ?? null,
      });

      if (rssResult.status === 'error') {
        await letterboxdRepository.markRssError(
          userId,
          rssResult.errorCode ?? 'rss_refresh_failed',
          rssResult.errorMessage ?? 'Unable to refresh Letterboxd activity',
        );
        await productAnalytics?.record({
          eventName: 'letterboxd_sync_failed', failureCategory: 'letterboxd_feed', sourceSurface: 'profile',
        });

        const [nextSettings, counts] = await Promise.all([
          letterboxdRepository.getSettings(userId),
          letterboxdRepository.countTitlesBySource(userId),
        ]);

        return res.status(502).json({
          error: rssResult.errorMessage ?? 'Unable to refresh Letterboxd activity',
          status: toLetterboxdStatusPayload(nextSettings, counts, username),
        });
      }

      if (rssResult.status === 'not_modified') {
        await letterboxdRepository.markRssNotModified(userId, {
          etag: rssResult.etag ?? settings?.rss_etag ?? null,
          lastModified: rssResult.lastModified ?? settings?.rss_last_modified ?? null,
        });
      } else {
        await letterboxdRepository.replaceRssTitles(userId, rssResult.titles, {
          etag: rssResult.etag ?? null,
          lastModified: rssResult.lastModified ?? null,
        });
      }

      const [nextSettings, counts] = await Promise.all([
        letterboxdRepository.getSettings(userId),
        letterboxdRepository.countTitlesBySource(userId),
      ]);
      await productAnalytics?.record({ eventName: 'letterboxd_sync_completed', responseStatus: 'success', sourceSurface: 'profile' });

      return res.json({
        refreshed: true,
        changed: rssResult.status === 'ok',
        importedCount: rssResult.status === 'ok' ? rssResult.titles.length : 0,
        status: toLetterboxdStatusPayload(nextSettings, counts, username),
      });
    } catch (error) {
      await productAnalytics?.record({
        eventName: 'letterboxd_sync_failed', failureCategory: classifyFailure(error, 'letterboxd_feed'), sourceSurface: 'profile',
      });
      logProfileRouteError('/letterboxd/refresh', req, error);
      return res.status(500).json({ error: 'Unable to refresh Letterboxd activity right now' });
    }
  });

  return router;
}
