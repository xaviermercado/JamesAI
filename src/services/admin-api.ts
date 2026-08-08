import { requestJson } from './http-client';
import type {
  AnalyticsOverviewDto,
  AdminAccessItemDto,
  AdminRole,
  AuditLogItemDto,
  ConfigurationAdapterOutput,
  ConfigurationFieldError,
  DateRangeQuery,
  FeedbackInboxItemDto,
  FeedbackReviewCategory,
  JamesConfiguration,
  PageDto,
  SandboxExample,
  SandboxResultDto,
  StoredConfiguration,
  VersionComparisonDto,
} from '@/types/admin';

type QueryValue = string | number | boolean | null | undefined;

function queryString<T extends object>(values: T): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    const queryValue = value as QueryValue;
    if (queryValue !== undefined && queryValue !== null && queryValue !== '') query.set(key, String(queryValue));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

function mutation(csrfToken: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): RequestInit {
  return {
    method,
    headers: { 'X-CSRF-Token': csrfToken },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export function listConfigurations(limit = 50, offset = 0): Promise<{ items: StoredConfiguration[] }> {
  return requestJson(`/api/admin/configurations${queryString({ limit, offset })}`, { method: 'GET' });
}

export function getConfiguration(configurationId: string): Promise<{ configuration: StoredConfiguration }> {
  return requestJson<StoredConfiguration>(`/api/admin/configurations/${encodeURIComponent(configurationId)}`, { method: 'GET' })
    .then((configuration) => ({ configuration }));
}

export function createConfigurationDraft(
  configuration: JamesConfiguration,
  changeReason: string | null,
  csrfToken: string,
): Promise<{ configuration: StoredConfiguration }> {
  return requestJson<StoredConfiguration>('/api/admin/configurations', mutation(csrfToken, 'POST', { configuration, changeReason }))
    .then((created) => ({ configuration: created }));
}

export function saveConfigurationDraft(
  configurationId: string,
  expectedRowVersion: number,
  configuration: JamesConfiguration,
  changeReason: string | null,
  csrfToken: string,
): Promise<{ configuration: StoredConfiguration }> {
  return requestJson<StoredConfiguration>(`/api/admin/configurations/${encodeURIComponent(configurationId)}`, {
    ...mutation(csrfToken, 'PATCH', {
    expectedRowVersion,
    configuration,
    changeReason,
    }),
    method: 'PUT',
  }).then((saved) => ({ configuration: saved }));
}

export function validateConfigurationDraft(
  configurationId: string,
  expectedRowVersion: number,
  csrfToken: string,
): Promise<{ configuration: StoredConfiguration; fieldErrors: ConfigurationFieldError[] }> {
  return requestJson(`/api/admin/configurations/${encodeURIComponent(configurationId)}/validate`, mutation(csrfToken, 'POST', { expectedRowVersion }));
}

export function previewConfiguration(
  configuration: JamesConfiguration,
  csrfToken: string,
): Promise<{ configuration: JamesConfiguration; adapterOutput: ConfigurationAdapterOutput; fieldErrors: ConfigurationFieldError[] }> {
  return requestJson('/api/admin/configurations/preview', mutation(csrfToken, 'POST', { configuration }));
}

export function publishConfiguration(
  configurationId: string,
  expectedRowVersion: number,
  csrfToken: string,
): Promise<{ configuration: StoredConfiguration }> {
  return requestJson<StoredConfiguration>(`/api/admin/configurations/${encodeURIComponent(configurationId)}/publish`, mutation(csrfToken, 'POST', { expectedRowVersion }))
    .then((configuration) => ({ configuration }));
}

export function rollbackConfiguration(
  sourceConfigurationId: string,
  changeReason: string,
  csrfToken: string,
): Promise<{ configuration: StoredConfiguration }> {
  return requestJson<StoredConfiguration>(`/api/admin/configurations/${encodeURIComponent(sourceConfigurationId)}/rollback`, mutation(csrfToken, 'POST', { changeReason }))
    .then((configuration) => ({ configuration }));
}

export function getAnalyticsOverview(query: DateRangeQuery): Promise<AnalyticsOverviewDto> {
  return requestJson(`/api/admin/insights/overview${queryString(query)}`, { method: 'GET' });
}

export function compareConfigurationVersions(query: DateRangeQuery & {
  baselineVersionId: string;
  comparisonVersionId: string;
}): Promise<VersionComparisonDto> {
  return requestJson(`/api/admin/insights/version-comparison${queryString(query)}`, { method: 'GET' });
}

export function listFeedbackInbox(query: DateRangeQuery & {
  feedbackCategory?: string;
  reviewCategory?: string;
  reviewStatus?: string;
  page?: number;
  pageSize?: number;
}): Promise<PageDto<FeedbackInboxItemDto>> {
  return requestJson(`/api/admin/feedback${queryString(query)}`, { method: 'GET' });
}

export function categorizeFeedback(
  analyticsEventId: string,
  category: FeedbackReviewCategory,
  expectedRowVersion: number | null,
  csrfToken: string,
): Promise<{ analyticsEventId: string; category: FeedbackReviewCategory; categorizedAt: string; rowVersion: number }> {
  return requestJson('/api/admin/feedback/categorize', mutation(csrfToken, 'POST', {
    analyticsEventId,
    category,
    expectedRowVersion,
  }));
}

export function listAuditLog(query: {
  action?: string;
  targetType?: string;
  outcome?: string;
  page?: number;
  pageSize?: number;
}): Promise<PageDto<AuditLogItemDto>> {
  return requestJson(`/api/admin/audit${queryString(query)}`, { method: 'GET' });
}

export function listAdminAccessCandidates(limit = 100, offset = 0): Promise<{ items: AdminAccessItemDto[] }> {
  return requestJson(`/api/admin/access${queryString({ limit, offset })}`, { method: 'GET' });
}

export function updateAdminAccess(
  userId: string,
  role: AdminRole,
  csrfToken: string,
): Promise<{ status: 'updated'; item: AdminAccessItemDto; revokedSessions: number }> {
  return requestJson(`/api/admin/access/${encodeURIComponent(userId)}`, mutation(csrfToken, 'PATCH', { role }));
}

export function runConfigurationSandbox(
  configurationId: string,
  examples: SandboxExample[],
  csrfToken: string,
): Promise<SandboxResultDto> {
  return requestJson('/api/admin/sandbox', mutation(csrfToken, 'POST', { configurationId, examples }));
}

export const adminApiInternals = { queryString };