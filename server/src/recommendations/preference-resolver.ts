// Preference resolver: merges server-loaded saved preferences with per-request temporary overrides.
// Precedence (high → low): explicit temporary override > saved profile preference > system default.
// This module is pure and side-effect-free — suitable for unit testing without I/O.

export interface SavedPreferences {
  marketCode: string | null;
  // providerIds is empty when the user has selected no services (distinct from "any").
  providerIds: number[];
  // languageCodes is empty when the user chose "Any language".
  languageCodes: string[];
}

export interface RequestOverrides {
  // Temporary market override. If empty/absent, the saved market is used.
  country?: string;
  // Temporary provider selection. `undefined` = inherit saved; `[]` = explicitly "any service".
  providerIds?: number[];
  // Temporary language selection. `undefined` = inherit saved; `[]` = explicitly "any language".
  originalLanguages?: string[];
  // Legacy name-based provider list — used when providerIds is absent (anonymous / old clients).
  streamingServices?: string[];
}

export type PreferenceSource = 'temporary' | 'saved' | 'none';

export interface EffectivePreferences {
  /** ISO 3166-1 alpha-2 market code used for this request. Undefined → no market filter. */
  effectiveMarket: string | undefined;
  /** TMDB provider IDs for this request. Undefined → no provider filter. */
  effectiveProviderIds: number[] | undefined;
  /** ISO 639-1 language codes for this request. Undefined → no language filter. */
  effectiveLanguages: string[] | undefined;
  /** Legacy name-based services list passed through as-is when providerIds are absent. */
  legacyStreamingServices: string[] | undefined;
  /** Diagnostic source info — do not expose to clients. */
  source: {
    market: PreferenceSource;
    providers: PreferenceSource;
    languages: PreferenceSource;
  };
  /** Whether any saved preference was used. */
  savedPreferencesApplied: boolean;
}

export function resolvePreferences(
  saved: SavedPreferences | null,
  overrides: RequestOverrides,
): EffectivePreferences {
  // ── Market ────────────────────────────────────────────────────────────────
  let effectiveMarket: string | undefined;
  let marketSource: PreferenceSource = 'none';

  const tempCountry = overrides.country?.trim().toUpperCase();
  if (tempCountry) {
    effectiveMarket = tempCountry;
    marketSource = 'temporary';
  } else if (saved?.marketCode) {
    effectiveMarket = saved.marketCode;
    marketSource = 'saved';
  }

  // ── Providers ─────────────────────────────────────────────────────────────
  let effectiveProviderIds: number[] | undefined;
  let legacyStreamingServices: string[] | undefined;
  let providerSource: PreferenceSource = 'none';

  if (overrides.providerIds !== undefined) {
    // Explicit temporary override. Empty array means "any service" — drop the filter.
    if (overrides.providerIds.length > 0) {
      effectiveProviderIds = [...new Set(overrides.providerIds)];
      providerSource = 'temporary';
    } else {
      // [] = explicitly "any service" → no filter
      providerSource = 'none';
    }
  } else if (overrides.streamingServices?.length) {
    // Legacy name-based list from anonymous / old clients.
    legacyStreamingServices = overrides.streamingServices;
    providerSource = 'temporary';
  } else if (saved?.providerIds && saved.providerIds.length > 0) {
    effectiveProviderIds = [...new Set(saved.providerIds)];
    providerSource = 'saved';
  }

  // ── Languages ─────────────────────────────────────────────────────────────
  let effectiveLanguages: string[] | undefined;
  let languageSource: PreferenceSource = 'none';

  if (overrides.originalLanguages !== undefined) {
    // Explicit temporary override. Empty array means "any language" — drop the filter.
    if (overrides.originalLanguages.length > 0) {
      effectiveLanguages = [...new Set(overrides.originalLanguages)];
      languageSource = 'temporary';
    } else {
      languageSource = 'none';
    }
  } else if (saved?.languageCodes && saved.languageCodes.length > 0) {
    effectiveLanguages = [...new Set(saved.languageCodes)];
    languageSource = 'saved';
  }

  const savedPreferencesApplied =
    marketSource === 'saved' || providerSource === 'saved' || languageSource === 'saved';

  return {
    effectiveMarket,
    effectiveProviderIds,
    effectiveLanguages,
    legacyStreamingServices,
    source: { market: marketSource, providers: providerSource, languages: languageSource },
    savedPreferencesApplied,
  };
}
