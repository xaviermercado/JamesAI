// Taste-signal calculator: converts explicit user feedback into bounded ranking signals.
// Pure and deterministic — no I/O, fully unit-testable.
// Only `liked` and `disliked` feedback contributes; `watched` is intentionally excluded.

export type FeedbackType = 'liked' | 'disliked' | 'watched';

export interface FeedbackEntry {
  feedbackType: FeedbackType;
  /** JSON-serialised array of genre name strings, e.g. '["Comedy","Drama"]'. May be null. */
  genresJson: string | null;
  /** ISO 639-1 original language code. May be null. */
  originalLanguage: string | null;
}

export interface TasteSignals {
  preferredGenres: string[];
  avoidedGenres: string[];
  preferredLanguages: string[];
  avoidedLanguages: string[];
  positiveCount: number;
  negativeCount: number;
  /** True only when enough explicit evidence exists to apply signals to ranking. */
  hasMinimumEvidence: boolean;
}

// Minimum liked+disliked entries (with metadata) required before signals are applied.
export const TASTE_SIGNAL_MIN_EVIDENCE = 2;

// Score bounds: no genre or language may accumulate more than this magnitude.
const MAX_RAW_SCORE = 3;

// Only include a genre/language in the signal output if its normalised score is above this.
const INCLUDE_THRESHOLD = 0.2;

// Maximum genres to forward to the ranking stage.
const MAX_SIGNAL_GENRES = 5;

// Maximum feedback entries to consider when building signals (prevents unbounded growth).
export const TASTE_SIGNAL_MAX_ENTRIES = 50;

export function calculateTasteSignals(entries: FeedbackEntry[]): TasteSignals {
  const genreScores: Record<string, number> = {};
  const languageScores: Record<string, number> = {};
  let positiveCount = 0;
  let negativeCount = 0;

  for (const entry of entries) {
    if (entry.feedbackType === 'watched') continue;

    const weight = entry.feedbackType === 'liked' ? 1 : -1;
    if (weight > 0) positiveCount++;
    else negativeCount++;

    // Parse and accumulate genre scores — limit to first 3 genres per title.
    if (entry.genresJson) {
      try {
        const genres = JSON.parse(entry.genresJson) as unknown;
        if (Array.isArray(genres)) {
          for (const genre of (genres as unknown[]).slice(0, 3)) {
            if (typeof genre === 'string' && genre.trim()) {
              const key = genre.trim();
              genreScores[key] = Math.max(-MAX_RAW_SCORE, Math.min(MAX_RAW_SCORE, (genreScores[key] ?? 0) + weight));
            }
          }
        }
      } catch {
        // Ignore malformed JSON — do not crash personalization.
      }
    }

    // Accumulate language scores.
    if (entry.originalLanguage?.trim()) {
      const lang = entry.originalLanguage.trim().toLowerCase().slice(0, 10);
      languageScores[lang] = Math.max(-MAX_RAW_SCORE, Math.min(MAX_RAW_SCORE, (languageScores[lang] ?? 0) + weight));
    }
  }

  const totalSignalEntries = positiveCount + negativeCount;
  const hasMinimumEvidence = totalSignalEntries >= TASTE_SIGNAL_MIN_EVIDENCE;

  // Normalise to [-1, 1] and apply inclusion threshold.
  const normalise = (raw: number) => raw / MAX_RAW_SCORE;

  const sortedGenres = Object.entries(genreScores)
    .map(([g, raw]) => ({ g, score: normalise(raw) }))
    .filter(({ score }) => Math.abs(score) >= INCLUDE_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  const preferredGenres = sortedGenres.filter(({ score }) => score > 0).slice(0, MAX_SIGNAL_GENRES).map(({ g }) => g);
  const avoidedGenres = sortedGenres.filter(({ score }) => score < 0).slice(-MAX_SIGNAL_GENRES).reverse().map(({ g }) => g);

  const sortedLangs = Object.entries(languageScores)
    .map(([l, raw]) => ({ l, score: normalise(raw) }))
    .filter(({ score }) => Math.abs(score) >= INCLUDE_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  const preferredLanguages = sortedLangs.filter(({ score }) => score > 0).map(({ l }) => l);
  const avoidedLanguages = sortedLangs.filter(({ score }) => score < 0).map(({ l }) => l);

  return {
    preferredGenres,
    avoidedGenres,
    preferredLanguages,
    avoidedLanguages,
    positiveCount,
    negativeCount,
    hasMinimumEvidence,
  };
}

/** Compact string representation for OpenAI ranking context. Safe to include in prompts. */
export function formatSignalsForPrompt(signals: TasteSignals): string | null {
  if (!signals.hasMinimumEvidence) return null;

  const parts: string[] = [];
  if (signals.preferredGenres.length > 0) parts.push(`Preferred genres (from feedback): ${signals.preferredGenres.join(', ')}.`);
  if (signals.avoidedGenres.length > 0) parts.push(`Deprioritise (but do not exclude): ${signals.avoidedGenres.join(', ')}.`);
  if (signals.preferredLanguages.length > 0) parts.push(`Preferred original languages (from feedback): ${signals.preferredLanguages.join(', ')}.`);

  return parts.length > 0 ? parts.join(' ') : null;
}
