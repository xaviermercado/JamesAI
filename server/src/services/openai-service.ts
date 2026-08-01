import type { MovieCandidate, MovieRecommendation, RecommendationRequest } from '../types/recommendations';

export interface OpenAiConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

interface OpenAiRankingPayload {
  rankings: Array<{
    tmdbMovieId: number;
    explanation: string;
  }>;
}

export class OpenAiService {
  constructor(private readonly config: OpenAiConfig) {}

  async rankCandidates(
    request: RecommendationRequest,
    candidates: MovieCandidate[],
  ): Promise<MovieRecommendation[]> {
    if (!this.config.apiKey || this.config.apiKey === 'missing-key') {
      return candidates.slice(0, 5).map((candidate) => ({
        ...candidate,
        explanation: `Temporary explanation based on the request: ${request.description}`,
      }));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch('https://api.openai.com/v1/responses.create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          input: [
            {
              role: 'system',
              content: 'You are ranking movie recommendations for a movie suggestion app. Return JSON with rankings array of {tmdbMovieId, explanation}.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                request,
                candidates: candidates.slice(0, 5),
              }),
            },
          ],
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`OpenAI request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as { output?: Array<{ content?: Array<{ text?: string }> }> };
      const text = payload.output?.[0]?.content?.[0]?.text ?? '{}';
      const parsed = JSON.parse(text) as OpenAiRankingPayload;
      const rankingMap = new Map(parsed.rankings?.map((item) => [item.tmdbMovieId, item.explanation]) ?? []);

      return candidates.slice(0, 5).map((candidate) => ({
        ...candidate,
        explanation: rankingMap.get(candidate.tmdbMovieId) ?? `Temporary explanation based on the request: ${request.description}`,
      }));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OpenAI request timed out');
      }
      return candidates.slice(0, 5).map((candidate) => ({
        ...candidate,
        explanation: `Temporary explanation based on the request: ${request.description}`,
      }));
    } finally {
      clearTimeout(timeout);
    }
  }
}
