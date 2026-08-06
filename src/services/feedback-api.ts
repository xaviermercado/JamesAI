import { requestJson } from './http-client';
import type { RecommendationFeedbackItem, SubmitFeedbackInput } from '@/types/feedback';

export async function getMyFeedback(): Promise<{ feedback: RecommendationFeedbackItem[] }> {
  return requestJson<{ feedback: RecommendationFeedbackItem[] }>('/api/feedback', { method: 'GET' });
}

export async function submitMyFeedback(input: SubmitFeedbackInput, csrfToken?: string | null): Promise<{ feedback: RecommendationFeedbackItem }> {
  return requestJson<{ feedback: RecommendationFeedbackItem }>('/api/feedback', {
    method: 'POST',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
    body: JSON.stringify(input),
  });
}

export async function removeMyFeedback(tmdbId: number, mediaType: 'movie' | 'tv', csrfToken?: string | null): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>(`/api/feedback/${tmdbId}/${mediaType}`, {
    method: 'DELETE',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
  });
}

export async function clearMyFeedback(csrfToken?: string | null): Promise<{ ok: boolean; count: number }> {
  return requestJson<{ ok: boolean; count: number }>('/api/feedback', {
    method: 'DELETE',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
  });
}
