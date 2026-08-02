import type { MovieCandidate, MovieRecommendation, RecommendationRequest } from '../types/recommendations';

export interface OpenAiConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export interface RequestInterpretation {
  searchQueries: string[];
  keywords: string[];
  genreIds: number[];
  yearRange: { start: string; end: string } | null;
}

interface OpenAiRankingPayload {
  rankings: Array<{
    tmdbMovieId: number;
    explanation: string;
  }>;
}

function buildFallbackRecommendations(request: RecommendationRequest, candidates: MovieCandidate[]): MovieRecommendation[] {
  return candidates.slice(0, 5).map((candidate) => ({
    ...candidate,
    explanation: `Matches your request: ${request.description}`,
  }));
}

const CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAiService {
  constructor(private readonly config: OpenAiConfig) {}

  private get isConfigured(): boolean {
    return Boolean(this.config.apiKey) && this.config.apiKey !== 'missing-key';
  }

  private async chatJson<T>(messages: Array<{ role: string; content: string }>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    console.log('[OpenAI] Making request to', CHAT_COMPLETIONS_URL, 'with model', this.config.model);

    try {
      const response = await fetch(CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[OpenAI] API error ${response.status}:`, errorText);
        throw new Error(`OpenAI request failed with status ${response.status}: ${errorText}`);
      }

      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = payload.choices?.[0]?.message?.content ?? '{}';
      console.log('[OpenAI] Response:', text);
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Phase 1: turn the user's free-text description into concrete TMDB search terms.
  async interpretRequest(request: RecommendationRequest): Promise<RequestInterpretation | null> {
    if (!this.isConfigured) {
      console.log('[OpenAI] Skipping interpretation: OpenAI not configured');
      return null;
    }

    try {
      console.log('[OpenAI] Interpreting request:', request.description);
      const result = await this.chatJson<RequestInterpretation>([
        {
          role: 'system',
          content:
            'You are a movie search assistant. Given a user description, return a JSON object with:\n' +
            '- searchQueries: string[] — up to 4 specific movie or TV show title searches that best match the request (e.g. ["Dumbo", "Dumbo 2019"])\n' +
            '- keywords: string[] — up to 4 short thematic keyword phrases for TMDB keyword search (e.g. ["flying elephant", "circus animal"])\n' +
            '- genreIds: number[] — relevant TMDB genre IDs (28=Action,12=Adventure,16=Animation,35=Comedy,80=Crime,99=Documentary,18=Drama,10751=Family,14=Fantasy,36=History,27=Horror,10402=Music,9648=Mystery,10749=Romance,878=SciFi,10770=TV Movie,53=Thriller,10752=War,37=Western)\n' +
            '- yearRange: {start:"YYYY-MM-DD",end:"YYYY-MM-DD"} | null — only if the user specifies a decade or era\n' +
            'Be specific. For "movies about flying elephants" you should return searchQueries:["Dumbo"] not popular movies.',
        },
        {
          role: 'user',
          content: JSON.stringify({ description: request.description, mediaType: request.mediaType ?? 'movie' }),
        },
      ]);
      console.log('[OpenAI] Interpretation result:', JSON.stringify(result));
      return result;
    } catch (error) {
      console.error('[OpenAI] interpretRequest failed:', error);
      return null;
    }
  }

  async rankCandidates(
    request: RecommendationRequest,
    candidates: MovieCandidate[],
  ): Promise<MovieRecommendation[]> {
    if (!this.isConfigured) {
      console.log('[OpenAI] Skipping ranking: OpenAI not configured');
      return buildFallbackRecommendations(request, candidates);
    }

    try {
      console.log('[OpenAI] Ranking', candidates.length, 'candidates');
      const parsed = await this.chatJson<OpenAiRankingPayload>([
        {
          role: 'system',
          content:
            'You are ranking movie recommendations. Return JSON with a rankings array of {tmdbMovieId, explanation}. ' +
            'Order from best to worst match. Only include movies that are a genuine match — drop any that are clearly irrelevant. ' +
            'Keep explanations to one sentence, specific to why this matches the request.',
        },
        {
          role: 'user',
          content: JSON.stringify({ request, candidates }),
        },
      ]);

      const rankingMap = new Map(parsed.rankings?.map((item) => [item.tmdbMovieId, item.explanation]) ?? []);
      console.log('[OpenAI] Ranking returned', rankingMap.size, 'ranked items');

      const ranked = [...candidates]
        .filter((c) => rankingMap.has(c.tmdbMovieId))
        .sort((a, b) => {
          const aIndex = parsed.rankings.findIndex((r) => r.tmdbMovieId === a.tmdbMovieId);
          const bIndex = parsed.rankings.findIndex((r) => r.tmdbMovieId === b.tmdbMovieId);
          return aIndex - bIndex;
        })
        .slice(0, 5);

      // Fall back to unfiltered candidates if OpenAI dropped everything
      const result = ranked.length > 0 ? ranked : candidates.slice(0, 5);
      console.log('[OpenAI] Final result:', result.length, 'recommendations');

      return result.map((candidate) => ({
        ...candidate,
        explanation: rankingMap.get(candidate.tmdbMovieId) ?? `Matches your request: ${request.description}`,
      }));
    } catch (error) {
      console.error('[OpenAI] rankCandidates failed:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OpenAI request timed out');
      }
      return buildFallbackRecommendations(request, candidates);
    }
  }
}
