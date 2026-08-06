import { describe, expect, it } from 'vitest';

import { resolvePreferences } from './preference-resolver';
import type { SavedPreferences } from './preference-resolver';

const fullPrefs: SavedPreferences = {
  marketCode: 'CA',
  providerIds: [8, 230],
  languageCodes: ['en', 'fr'],
};

describe('resolvePreferences', () => {
  it('uses saved preferences when no overrides are present', () => {
    const result = resolvePreferences(fullPrefs, {});
    expect(result.effectiveMarket).toBe('CA');
    expect(result.effectiveProviderIds).toEqual([8, 230]);
    expect(result.effectiveLanguages).toEqual(['en', 'fr']);
    expect(result.savedPreferencesApplied).toBe(true);
    expect(result.source.market).toBe('saved');
    expect(result.source.providers).toBe('saved');
    expect(result.source.languages).toBe('saved');
  });

  it('temporary market overrides the saved market', () => {
    const result = resolvePreferences(fullPrefs, { country: 'FR' });
    expect(result.effectiveMarket).toBe('FR');
    expect(result.source.market).toBe('temporary');
    // Other preferences still from saved
    expect(result.effectiveProviderIds).toEqual([8, 230]);
    expect(result.source.providers).toBe('saved');
  });

  it('temporary providerIds overrides saved providers', () => {
    const result = resolvePreferences(fullPrefs, { providerIds: [337] });
    expect(result.effectiveProviderIds).toEqual([337]);
    expect(result.source.providers).toBe('temporary');
    expect(result.source.market).toBe('saved');
  });

  it('empty providerIds means "any service" and clears provider filter', () => {
    const result = resolvePreferences(fullPrefs, { providerIds: [] });
    expect(result.effectiveProviderIds).toBeUndefined();
    expect(result.source.providers).toBe('none');
  });

  it('temporary languages override saved languages', () => {
    const result = resolvePreferences(fullPrefs, { originalLanguages: ['ja'] });
    expect(result.effectiveLanguages).toEqual(['ja']);
    expect(result.source.languages).toBe('temporary');
  });

  it('empty originalLanguages means "any language" and clears language filter', () => {
    const result = resolvePreferences(fullPrefs, { originalLanguages: [] });
    expect(result.effectiveLanguages).toBeUndefined();
    expect(result.source.languages).toBe('none');
  });

  it('null saved preferences results in no effective constraints', () => {
    const result = resolvePreferences(null, {});
    expect(result.effectiveMarket).toBeUndefined();
    expect(result.effectiveProviderIds).toBeUndefined();
    expect(result.effectiveLanguages).toBeUndefined();
    expect(result.savedPreferencesApplied).toBe(false);
  });

  it('anonymous user with temporary overrides uses only those values', () => {
    const result = resolvePreferences(null, { country: 'US', providerIds: [8], originalLanguages: ['en'] });
    expect(result.effectiveMarket).toBe('US');
    expect(result.effectiveProviderIds).toEqual([8]);
    expect(result.effectiveLanguages).toEqual(['en']);
    expect(result.savedPreferencesApplied).toBe(false);
    expect(result.source.market).toBe('temporary');
    expect(result.source.providers).toBe('temporary');
    expect(result.source.languages).toBe('temporary');
  });

  it('legacy streamingServices name list is passed through when providerIds absent', () => {
    const result = resolvePreferences(null, { streamingServices: ['Netflix', 'Prime Video'] });
    expect(result.legacyStreamingServices).toEqual(['Netflix', 'Prime Video']);
    expect(result.effectiveProviderIds).toBeUndefined();
    expect(result.source.providers).toBe('temporary');
  });

  it('providerIds takes precedence over legacy streamingServices when both are present', () => {
    const result = resolvePreferences(null, { providerIds: [337], streamingServices: ['Netflix'] });
    expect(result.effectiveProviderIds).toEqual([337]);
    expect(result.legacyStreamingServices).toBeUndefined();
  });

  it('deduplicates provider IDs', () => {
    const result = resolvePreferences(null, { providerIds: [8, 8, 337] });
    expect(result.effectiveProviderIds).toEqual([8, 337]);
  });

  it('deduplicates language codes', () => {
    const result = resolvePreferences(null, { originalLanguages: ['fr', 'en', 'fr'] });
    expect(result.effectiveLanguages).toEqual(['fr', 'en']);
  });

  it('country override is normalized to uppercase', () => {
    const result = resolvePreferences(null, { country: 'us' });
    expect(result.effectiveMarket).toBe('US');
  });

  it('saved preferences with only market applies market only', () => {
    const result = resolvePreferences({ marketCode: 'JP', providerIds: [], languageCodes: [] }, {});
    expect(result.effectiveMarket).toBe('JP');
    expect(result.effectiveProviderIds).toBeUndefined();
    expect(result.effectiveLanguages).toBeUndefined();
    expect(result.savedPreferencesApplied).toBe(true);
    expect(result.source.providers).toBe('none');
    expect(result.source.languages).toBe('none');
  });

  it('temporary override does not mutate the saved preferences object', () => {
    const saved = { marketCode: 'CA', providerIds: [8], languageCodes: ['en'] };
    resolvePreferences(saved, { country: 'FR', providerIds: [337], originalLanguages: ['ja'] });
    expect(saved.marketCode).toBe('CA');
    expect(saved.providerIds).toEqual([8]);
    expect(saved.languageCodes).toEqual(['en']);
  });

  it('savedPreferencesApplied is true only when at least one dimension comes from saved', () => {
    const savedMarketOnly = resolvePreferences({ marketCode: 'AU', providerIds: [], languageCodes: [] }, { country: 'US' });
    expect(savedMarketOnly.savedPreferencesApplied).toBe(false);

    const savedProviders = resolvePreferences({ marketCode: null, providerIds: [8], languageCodes: [] }, {});
    expect(savedProviders.savedPreferencesApplied).toBe(true);
  });
});
