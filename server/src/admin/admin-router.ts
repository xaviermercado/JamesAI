import type { Request, Response } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import type { AppConfig } from '../config/env';
import type { TmdbService } from '../services/tmdb-service';
import type { MovieRecommendation, RecommendationRequest } from '../types/recommendations';
import { logger } from '../utils/logger';
import type { AdminAccessRepositoryLike } from './admin-access-repository';
import type { AdminAuthorization } from './admin-authorization';
import { adaptConfiguration } from './configuration/configuration-adapter';
import { validateConfiguration } from './configuration/configuration-schema';
import {
  ConfigurationOperationError,
  type ConfigurationService,
} from './configuration/configuration-service';
import type { StoredConfiguration } from './configuration/configuration-repository';
import {
  applyConfigurationToRecommendations,
  applyConfigurationToRequest,
} from './configuration/recommendation-adapter';
import {
  analyticsQuerySchema,
  auditLogQuerySchema,
  categorizeFeedbackSchema,
  feedbackInboxQuerySchema,
  versionComparisonQuerySchema,
} from './insights/insights-schemas';
import type { InsightsService } from './insights/insights-service';

const ADMIN_BODY_LIMIT_BYTES = 128 * 1024;
const uuidSchema = z.string().uuid();
const rowVersionSchema = z.number().int().min(1);
const reasonSchema = z.string().trim().min(1).max(240).nullable().optional();
const createDraftSchema = z.object({ configuration: z.unknown().optional(), changeReason: reasonSchema }).strict();
const saveDraftSchema = z.object({ expectedRowVersion: rowVersionSchema, configuration: z.unknown(), changeReason: reasonSchema }).strict();
const rowVersionBodySchema = z.object({ expectedRowVersion: rowVersionSchema }).strict();
const previewSchema = z.object({ configuration: z.unknown() }).strict();
const rollbackSchema = z.object({ changeReason: reasonSchema }).strict();
const listConfigurationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
}).strict();
const accessUpdateSchema = z.object({ role: z.enum(['user', 'editor', 'owner']) }).strict();
const titleSearchSchema = z.object({
  query: z.string().trim().min(2).max(100),
  mediaType: z.enum(['movie', 'tv']).optional(),
}).strict();
const sandboxSchema = z.object({
  configurationId: uuidSchema,
  examples: z.array(z.object({
    description: z.string().trim().min(1).max(300),
    mediaType: z.enum(['movie', 'tv']).default('movie'),
    country: z.string().regex(/^[A-Z]{2}$/).optional(),
  }).strict()).min(1).max(5),
}).strict();
const SANDBOX_EXPLANATION_LIMIT = 240;

function toSandboxItem(item: MovieRecommendation) {
  return {
    title: item.title,
    mediaType: item.mediaType,
    availability: item.providers.length > 0 ? 'available' as const : 'unknown' as const,
    explanation: item.explanation.slice(0, SANDBOX_EXPLANATION_LIMIT),
  };
}

export interface AdminRouterDependencies {
  config: Pick<AppConfig, 'frontendOrigin' | 'nodeEnv'>;
  authorization: AdminAuthorization;
  configurationService: ConfigurationService;
  insightsService: InsightsService;
  adminAccessRepository: AdminAccessRepositoryLike;
  tmdbService: TmdbService;
}

export interface AdminRouterOptions {
  rateLimitMax?: number;
  sandboxTimeoutMs?: number;
}

function safeJsonSize(value: unknown): number {
  try { return Buffer.byteLength(JSON.stringify(value), 'utf8'); } catch { return ADMIN_BODY_LIMIT_BYTES + 1; }
}

function parseStoredConfiguration(stored: StoredConfiguration): unknown {
  try { return JSON.parse(stored.configurationJson) as unknown; } catch { return null; }
}

function toConfigurationDto(stored: StoredConfiguration) {
  const { configurationJson: _configurationJson, validationErrorsJson, ...metadata } = stored;
  let validationErrors: unknown = null;
  try { validationErrors = validationErrorsJson ? JSON.parse(validationErrorsJson) : null; } catch { validationErrors = null; }
  return { ...metadata, configuration: parseStoredConfiguration(stored), validationErrors };
}

function validationError(res: Response, error: z.ZodError) {
  return res.status(400).json({ error: error.flatten().fieldErrors });
}

function operationError(res: Response, error: ConfigurationOperationError) {
  const status = error.code === 'not_found' ? 404 : error.code === 'conflict' ? 409 : 400;
  return res.status(status).json({ error: error.message, fieldErrors: error.fieldErrors });
}

function safeRouteError(route: string, res: Response, error: unknown) {
  if (error instanceof ConfigurationOperationError) return operationError(res, error);
  logger.error('admin.route_error', { route, category: 'internal' });
  return res.status(500).json({ error: 'Unable to complete the admin request' });
}

function contextUserId(dependencies: AdminRouterDependencies, res: Response): string {
  return dependencies.authorization.getContext(res)!.identity.userId;
}

export function createAdminRouter(dependencies: AdminRouterDependencies, options: AdminRouterOptions = {}) {
  const router = express.Router();
  const max = options.rateLimitMax ?? (dependencies.config.nodeEnv === 'production' ? 10 : 1_000);
  const limited = rateLimit({ windowMs: 60_000, max, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many admin requests' } });
  let sandboxRunning = false;

  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && dependencies.config.frontendOrigin && req.headers.origin && req.headers.origin !== dependencies.config.frontendOrigin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const contentLength = Number(req.get('content-length') ?? 0);
    if (contentLength > ADMIN_BODY_LIMIT_BYTES || (req.body !== undefined && safeJsonSize(req.body) > ADMIN_BODY_LIMIT_BYTES)) {
      return res.status(413).json({ error: 'Request body is too large' });
    }
    next();
  });

  router.get('/configurations', dependencies.authorization.requireCapability('view_configuration_audit'), async (req, res) => {
    const parsed = listConfigurationSchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error);
    try {
      const items = await dependencies.configurationService.listConfigurations(parsed.data.limit, parsed.data.offset);
      return res.json({ items: items.map(toConfigurationDto) });
    } catch (error) { return safeRouteError('GET /configurations', res, error); }
  });

  router.get('/configurations/current', dependencies.authorization.requireCapability('view_configuration_audit'), async (_req, res) => {
    try { return res.json(toConfigurationDto((await dependencies.configurationService.getEffectiveConfiguration()).stored)); }
    catch (error) { return safeRouteError('GET /configurations/current', res, error); }
  });

  router.get('/configurations/:configurationId', dependencies.authorization.requireCapability('view_configuration_audit'), async (req, res) => {
    const id = uuidSchema.safeParse(req.params.configurationId);
    if (!id.success) return validationError(res, id.error);
    try {
      const item = await dependencies.configurationService.getConfiguration(id.data);
      return item ? res.json(toConfigurationDto(item)) : res.status(404).json({ error: 'Configuration not found' });
    } catch (error) { return safeRouteError('GET /configurations/:id', res, error); }
  });

  router.post('/configurations', dependencies.authorization.requireCapability('create_configuration'), async (req, res) => {
    const parsed = createDraftSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);
    try {
      const item = await dependencies.configurationService.createDraft(contextUserId(dependencies, res), parsed.data.configuration, parsed.data.changeReason ?? null);
      return res.status(201).json(toConfigurationDto(item));
    } catch (error) { return safeRouteError('POST /configurations', res, error); }
  });

  router.put('/configurations/:configurationId', dependencies.authorization.requireCapability('edit_configuration'), async (req, res) => {
    const id = uuidSchema.safeParse(req.params.configurationId);
    const parsed = saveDraftSchema.safeParse(req.body);
    if (!id.success) return validationError(res, id.error);
    if (!parsed.success) return validationError(res, parsed.error);
    try {
      const item = await dependencies.configurationService.saveDraft(id.data, parsed.data.expectedRowVersion, parsed.data.configuration, contextUserId(dependencies, res), parsed.data.changeReason ?? null);
      return res.json(toConfigurationDto(item));
    } catch (error) { return safeRouteError('PUT /configurations/:id', res, error); }
  });

  router.delete('/configurations/:configurationId', dependencies.authorization.requireCapability('edit_configuration'), async (req, res) => {
    const id = uuidSchema.safeParse(req.params.configurationId);
    const parsed = rowVersionBodySchema.safeParse(req.body);
    if (!id.success) return validationError(res, id.error);
    if (!parsed.success) return validationError(res, parsed.error);
    try {
      await dependencies.configurationService.deleteDraft(id.data, parsed.data.expectedRowVersion);
      return res.status(204).end();
    } catch (error) { return safeRouteError('DELETE /configurations/:id', res, error); }
  });

  router.post('/configurations/:configurationId/validate', dependencies.authorization.requireCapability('validate_configuration'), async (req, res) => {
    const id = uuidSchema.safeParse(req.params.configurationId);
    const parsed = rowVersionBodySchema.safeParse(req.body);
    if (!id.success) return validationError(res, id.error);
    if (!parsed.success) return validationError(res, parsed.error);
    try {
      const result = await dependencies.configurationService.validateDraft(id.data, parsed.data.expectedRowVersion, contextUserId(dependencies, res));
      return res.json({ configuration: toConfigurationDto(result.configuration), fieldErrors: result.fieldErrors });
    } catch (error) { return safeRouteError('POST /configurations/:id/validate', res, error); }
  });

  router.post('/configurations/preview', limited, dependencies.authorization.requireCapability('preview_configuration'), async (req, res) => {
    const parsed = previewSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);
    try { return res.json(await dependencies.configurationService.preview(parsed.data.configuration, new Date(), contextUserId(dependencies, res))); }
    catch (error) { return safeRouteError('POST /configurations/preview', res, error); }
  });

  router.post('/configurations/:configurationId/publish', limited, dependencies.authorization.requireCapability('publish_configuration'), async (req, res) => {
    const id = uuidSchema.safeParse(req.params.configurationId);
    const parsed = rowVersionBodySchema.safeParse(req.body);
    if (!id.success) return validationError(res, id.error);
    if (!parsed.success) return validationError(res, parsed.error);
    try {
      const item = await dependencies.configurationService.publish(id.data, parsed.data.expectedRowVersion, contextUserId(dependencies, res));
      return res.json(toConfigurationDto(item));
    } catch (error) { return safeRouteError('POST /configurations/:id/publish', res, error); }
  });

  router.post('/configurations/:configurationId/rollback', limited, dependencies.authorization.requireCapability('rollback_configuration'), async (req, res) => {
    const id = uuidSchema.safeParse(req.params.configurationId);
    const parsed = rollbackSchema.safeParse(req.body);
    if (!id.success) return validationError(res, id.error);
    if (!parsed.success) return validationError(res, parsed.error);
    try {
      const item = await dependencies.configurationService.rollback(id.data, contextUserId(dependencies, res), parsed.data.changeReason ?? null);
      return res.json(toConfigurationDto(item));
    } catch (error) { return safeRouteError('POST /configurations/:id/rollback', res, error); }
  });

  router.get('/insights/overview', dependencies.authorization.requireCapability('view_insights'), async (req, res) => {
    const parsed = analyticsQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error);
    try { return res.json(await dependencies.insightsService.getOverview(parsed.data)); }
    catch (error) { return safeRouteError('GET /insights/overview', res, error); }
  });

  router.get('/insights/segments', dependencies.authorization.requireCapability('view_insights'), async (req, res) => {
    const parsed = analyticsQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error);
    try { return res.json({ items: await dependencies.insightsService.getSegments(parsed.data) }); }
    catch (error) { return safeRouteError('GET /insights/segments', res, error); }
  });

  router.get('/insights/version-comparison', dependencies.authorization.requireCapability('view_insights'), async (req, res) => {
    const parsed = versionComparisonQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error);
    try { return res.json(await dependencies.insightsService.compareVersions(parsed.data)); }
    catch (error) { return safeRouteError('GET /insights/version-comparison', res, error); }
  });

  router.get('/feedback', dependencies.authorization.requireCapability('view_minimized_feedback'), async (req, res) => {
    const parsed = feedbackInboxQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error);
    try { return res.json(await dependencies.insightsService.listFeedbackInbox(parsed.data)); }
    catch (error) { return safeRouteError('GET /feedback', res, error); }
  });

  router.post('/feedback/categorize', dependencies.authorization.requireCapability('view_minimized_feedback'), async (req, res) => {
    const parsed = categorizeFeedbackSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);
    try {
      const result = await dependencies.insightsService.categorizeFeedback(parsed.data, contextUserId(dependencies, res));
      if (result.status === 'not_found') return res.status(404).json({ error: 'Feedback event not found' });
      if (result.status === 'conflict') return res.status(409).json({ error: 'Feedback review changed; refresh and retry' });
      return res.json(result.item);
    } catch (error) { return safeRouteError('POST /feedback/categorize', res, error); }
  });

  router.get('/audit', dependencies.authorization.requireCapability('view_configuration_audit'), async (req, res) => {
    const parsed = auditLogQuerySchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error);
    try {
      const role = dependencies.authorization.getContext(res)!.user.adminRole;
      return res.json(await dependencies.insightsService.listAuditLog(parsed.data, role === 'owner' ? 'owner' : 'editor'));
    } catch (error) { return safeRouteError('GET /audit', res, error); }
  });

  router.get('/access', dependencies.authorization.requireCapability('manage_admin_access'), async (_req, res) => {
    const parsed = listConfigurationSchema.safeParse(_req.query);
    if (!parsed.success) return validationError(res, parsed.error);
    try { return res.json({ items: await dependencies.adminAccessRepository.listAccessCandidates(parsed.data.limit, parsed.data.offset) }); }
    catch (error) { return safeRouteError('GET /access', res, error); }
  });

  router.patch('/access/:userId', dependencies.authorization.requireCapability('manage_admin_access'), async (req, res) => {
    const userId = uuidSchema.safeParse(req.params.userId);
    const parsed = accessUpdateSchema.safeParse(req.body);
    if (!userId.success) return validationError(res, userId.error);
    if (!parsed.success) return validationError(res, parsed.error);
    try {
      const result = await dependencies.adminAccessRepository.updateAdminRole(userId.data, parsed.data.role, contextUserId(dependencies, res));
      if (result.status === 'not_found') return res.status(404).json({ error: 'Administrator not found' });
      if (result.status === 'last_owner') return res.status(409).json({ error: 'At least one active owner is required' });
      return res.json(result);
    } catch (error) { return safeRouteError('PATCH /access/:userId', res, error); }
  });

  router.get('/metadata/titles', dependencies.authorization.requireCapability('edit_configuration'), async (req, res) => {
    const parsed = titleSearchSchema.safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error);
    try { return res.json({ items: await dependencies.tmdbService.searchTitles(parsed.data.query, parsed.data.mediaType) }); }
    catch (error) { return safeRouteError('GET /metadata/titles', res, error); }
  });

  router.post('/sandbox', limited, dependencies.authorization.requireCapability('run_sandbox'), async (req, res) => {
    if (sandboxRunning) return res.status(429).json({ error: 'Sandbox is already running' });
    const parsed = sandboxSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);
    sandboxRunning = true;
    try {
      const [active, selected] = await Promise.all([
        dependencies.configurationService.getEffectiveConfiguration(),
        dependencies.configurationService.getConfiguration(parsed.data.configurationId),
      ]);
      if (!selected) return res.status(404).json({ error: 'Configuration not found' });
      if (selected.validationStatus !== 'valid') return res.status(400).json({ error: 'Select a valid configuration' });
      const selectedValidation = validateConfiguration(parseStoredConfiguration(selected));
      if (!selectedValidation.success) return res.status(400).json({ error: 'Select a valid configuration' });
      const activeAdapter = adaptConfiguration(active.configuration);
      const selectedPreview = await dependencies.configurationService.preview(
        selectedValidation.configuration,
        new Date(),
        contextUserId(dependencies, res),
      );
      const selectedAdapter = selectedPreview.adapterOutput;
      const timeoutMs = options.sandboxTimeoutMs ?? 20_000;
      const work = Promise.all(parsed.data.examples.map(async (example, index) => {
        const baseRequest: RecommendationRequest = { ...example };
        const [activeResult, selectedResult] = await Promise.all([
          dependencies.tmdbService.getRecommendations(applyConfigurationToRequest(baseRequest, activeAdapter)),
          dependencies.tmdbService.getRecommendations(applyConfigurationToRequest(baseRequest, selectedAdapter)),
        ]);
        const activeItems = applyConfigurationToRecommendations(activeResult.recommendations, activeAdapter);
        const selectedItems = applyConfigurationToRecommendations(selectedResult.recommendations, selectedAdapter);
        return {
          example: index + 1,
          active: { count: activeItems.length, items: activeItems.map(toSandboxItem) },
          selected: { count: selectedItems.length, items: selectedItems.map(toSandboxItem) },
        };
      }));
      const results = await Promise.race([
        work,
        new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('sandbox timeout')), timeoutMs)),
      ]);
      return res.json({ activeConfigurationId: active.stored.configurationId, selectedConfigurationId: selected.configurationId, results });
    } catch (error) { return safeRouteError('POST /sandbox', res, error); }
    finally { sandboxRunning = false; }
  });

  return router;
}