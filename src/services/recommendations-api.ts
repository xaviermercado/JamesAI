import type { RecommendationRequest, RecommendationResponse } from '@/types/recommendations';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');

function toErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to load recommendations.';
}

export async function getRecommendations(request: RecommendationRequest): Promise<RecommendationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/recommendations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const message =
        typeof errorPayload.error === 'string'
          ? errorPayload.error
          : 'Unable to load recommendations.';
      throw new Error(message);
    }

    return response.json() as Promise<RecommendationResponse>;
  } catch (error) {
    throw new Error(toErrorMessage(error));
  }
}
