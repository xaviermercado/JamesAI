import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { getMyPreferences, updateMyPreferences } from '@/services/profile-api';
import type {
  ContentLanguageSelection,
  CountryCatalogItem,
  LanguageCatalogItem,
  StreamingServiceCatalogItem,
  UserStreamingService,
  ViewingFormatPreference,
} from '@/types/profile';

const VIEWING_FORMAT_OPTIONS: { value: ViewingFormatPreference | null; label: string }[] = [
  { value: null, label: 'No preference' },
  { value: 'subtitles_ok', label: 'Subtitles are fine' },
  { value: 'prefer_dubbed', label: 'Prefer dubbed versions' },
];

export default function PreferencesScreen() {
  const router = useRouter();
  const { csrfToken } = useAuthSession();

  const [marketCode, setMarketCode] = useState<string>('US');
  const [savedMarketCode, setSavedMarketCode] = useState<string | null>(null);
  const [selectedProviderIds, setSelectedProviderIds] = useState<number[]>([]);
  const [selectedLanguageCodes, setSelectedLanguageCodes] = useState<string[]>([]);
  const [viewingFormat, setViewingFormat] = useState<ViewingFormatPreference | null>(null);

  const [providerCatalog, setProviderCatalog] = useState<StreamingServiceCatalogItem[]>([]);
  const [countryCatalog, setCountryCatalog] = useState<CountryCatalogItem[]>([]);
  const [languageCatalog, setLanguageCatalog] = useState<LanguageCatalogItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Warn user when they change from their saved market without saving.
  const marketChanged = savedMarketCode !== null && marketCode !== savedMarketCode;

  const [countrySearch, setCountrySearch] = useState('');
  const [langSearch, setLangSearch] = useState('');

  const filteredCountries = useMemo(
    () =>
      countryCatalog.filter(
        (c) =>
          c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
          c.code.toLowerCase().includes(countrySearch.toLowerCase()),
      ),
    [countryCatalog, countrySearch],
  );

  const filteredLanguages = useMemo(
    () =>
      languageCatalog.filter(
        (l) =>
          l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
          l.code.toLowerCase().includes(langSearch.toLowerCase()),
      ),
    [languageCatalog, langSearch],
  );

  useEffect(() => {
    let active = true;
    void getMyPreferences()
      .then((response) => {
        if (!active) return;
        const market = response.marketCode ?? 'US';
        setMarketCode(market);
        setSavedMarketCode(market);
        setSelectedProviderIds(response.streamingServices.map((s: UserStreamingService) => s.providerId));
        setSelectedLanguageCodes(
          [...response.contentLanguages]
            .sort((a: ContentLanguageSelection, b: ContentLanguageSelection) => a.sortOrder - b.sortOrder)
            .map((l: ContentLanguageSelection) => l.languageCode),
        );
        setViewingFormat(response.viewingFormatPreference);
        setProviderCatalog([...response.catalog.providers]);
        setCountryCatalog([...response.catalog.countries]);
        setLanguageCatalog([...response.catalog.languages]);
      })
      .catch((error) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load your preferences right now.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const toggleProvider = (id: number) => {
    setSelectedProviderIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const toggleLanguage = (code: string) => {
    setSelectedLanguageCodes((current) =>
      current.includes(code) ? current.filter((x) => x !== code) : [...current, code],
    );
  };

  const moveLanguage = (code: string, direction: 'up' | 'down') => {
    setSelectedLanguageCodes((current) => {
      const index = current.indexOf(code);
      if (index === -1) return current;
      const next = [...current];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= next.length) return current;
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await updateMyPreferences(
        {
          marketCode,
          providerIds: selectedProviderIds,
          languageCodes: selectedLanguageCodes,
          viewingFormatPreference: viewingFormat,
        },
        csrfToken,
      );
      setSavedMarketCode(marketCode);
      setSaveSuccess(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save preferences right now.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={BrandColors.scoutyBlue} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.pageHeader}>
            <ThemedText type="subtitle">Viewing preferences</ThemedText>
            <ThemedText themeColor="textSecondary">
              These preferences will be available to Scouty for personalized recommendations in a future step.
            </ThemedText>
          </View>

          {loadError ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText style={styles.errorText}>{loadError}</ThemedText>
            </ThemedView>
          ) : null}

          {/* ── Section 1: Streaming region ── */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Streaming region</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              Choose the country where you usually watch. Streaming availability varies by region.
            </ThemedText>
            {marketChanged ? (
              <View style={styles.warningBanner}>
                <ThemedText style={styles.warningText}>
                  You changed your streaming region. Review your selected services — some may not be available in the new region.
                </ThemedText>
              </View>
            ) : null}
            <TextInput
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search countries..."
              placeholderTextColor="#8a8f98"
              style={styles.searchInput}
              accessibilityLabel="Search countries"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <ScrollView style={styles.selectList} nestedScrollEnabled>
              {filteredCountries.map((country) => {
                const isSelected = marketCode === country.code;
                return (
                  <Pressable
                    key={country.code}
                    accessibilityRole="radio"
                    accessibilityLabel={country.name}
                    accessibilityState={{ selected: isSelected }}
                    style={[styles.listItem, isSelected && styles.listItemSelected]}
                    onPress={() => setMarketCode(country.code)}
                  >
                    <ThemedText style={[styles.listItemText, isSelected && styles.listItemTextSelected]}>
                      {country.name}
                    </ThemedText>
                    {isSelected ? <ThemedText style={styles.checkmark}>✓</ThemedText> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </ThemedView>

          {/* ── Section 2: Streaming services ── */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Your streaming services</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              Select the services you currently subscribe to. Scouty will use these as a guide — it cannot verify current availability.
            </ThemedText>
            <View style={styles.chipGrid}>
              {providerCatalog.map((provider) => {
                const isSelected = selectedProviderIds.includes(provider.providerId);
                return (
                  <Pressable
                    key={provider.providerId}
                    accessibilityRole="checkbox"
                    accessibilityLabel={provider.providerName}
                    accessibilityState={{ checked: isSelected }}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => toggleProvider(provider.providerId)}
                  >
                    <ThemedText style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {provider.providerName}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {selectedProviderIds.length === 0 ? (
              <ThemedText themeColor="textSecondary" style={styles.hint}>
              No services selected — Scouty will not filter by platform.
              </ThemedText>
            ) : null}
          </ThemedView>

          {/* ── Section 3: Content languages ── */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Preferred content languages</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              Choose one or more languages in which titles were originally made. Multiple selections mean titles in any of those languages — not all at once.
            </ThemedText>

            {selectedLanguageCodes.length > 0 ? (
              <View style={styles.selectedLanguageList}>
                <ThemedText style={styles.subLabel}>Selected (use arrows to reorder by priority)</ThemedText>
                {selectedLanguageCodes.map((code, index) => {
                  const lang = languageCatalog.find((l) => l.code === code);
                  return (
                    <View key={code} style={styles.languageRow}>
                      <ThemedText style={styles.languageRowText}>{lang?.name ?? code}</ThemedText>
                      <View style={styles.languageRowActions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Move ${lang?.name ?? code} up`}
                          style={[styles.moveBtn, index === 0 && styles.moveBtnDisabled]}
                          onPress={() => moveLanguage(code, 'up')}
                          disabled={index === 0}
                        >
                          <ThemedText style={styles.moveBtnText}>↑</ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Move ${lang?.name ?? code} down`}
                          style={[styles.moveBtn, index === selectedLanguageCodes.length - 1 && styles.moveBtnDisabled]}
                          onPress={() => moveLanguage(code, 'down')}
                          disabled={index === selectedLanguageCodes.length - 1}
                        >
                          <ThemedText style={styles.moveBtnText}>↓</ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${lang?.name ?? code}`}
                          style={styles.removeBtn}
                          onPress={() => toggleLanguage(code)}
                        >
                          <ThemedText style={styles.removeBtnText}>✕</ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.anyLanguageBadge}>
                <ThemedText style={styles.anyLanguageText}>Any language</ThemedText>
              </View>
            )}

            <TextInput
              value={langSearch}
              onChangeText={setLangSearch}
              placeholder="Search languages..."
              placeholderTextColor="#8a8f98"
              style={styles.searchInput}
              accessibilityLabel="Add a language"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <View style={styles.chipGrid}>
              {filteredLanguages.map((lang) => {
                const isSelected = selectedLanguageCodes.includes(lang.code);
                return (
                  <Pressable
                    key={lang.code}
                    accessibilityRole="checkbox"
                    accessibilityLabel={lang.name}
                    accessibilityState={{ checked: isSelected }}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => toggleLanguage(lang.code)}
                  >
                    <ThemedText style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {lang.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </ThemedView>

          {/* ── Section 4: Viewing format ── */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Subtitles and dubbing</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              How you prefer to watch content not in a language you speak. Scouty cannot guarantee availability.
            </ThemedText>
            <View style={styles.radioGroup} accessibilityRole="radiogroup">
              {VIEWING_FORMAT_OPTIONS.map((option) => {
                const isSelected = viewingFormat === option.value;
                return (
                  <Pressable
                    key={String(option.value)}
                    accessibilityRole="radio"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected: isSelected }}
                    style={[styles.radioItem, isSelected && styles.radioItemSelected]}
                    onPress={() => setViewingFormat(option.value)}
                  >
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                      {isSelected ? <View style={styles.radioDot} /> : null}
                    </View>
                    <ThemedText style={styles.radioLabel}>{option.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </ThemedView>

          {/* ── Actions ── */}
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save preferences"
              style={[styles.primaryButton, saving && styles.buttonDisabled]}
              onPress={() => void save()}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#ffffff" />
                : <ThemedText style={styles.primaryButtonText}>Save preferences</ThemedText>}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={styles.secondaryButton}
              onPress={() => router.replace('/profile' as never)}
            >
              <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
            </Pressable>
          </View>

          {saveSuccess ? (
            <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite" style={styles.successText}>
              Preferences saved. These will guide Scouty when personalized recommendations are enabled.
            </ThemedText>
          ) : null}
          {saveError ? (
            <ThemedText style={styles.errorText} accessibilityLiveRegion="polite">{saveError}</ThemedText>
          ) : null}

          <AppFooter />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contentContainer: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  pageHeader: { gap: Spacing.two },
  card: {
    borderRadius: Radii.large,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  hint: { fontSize: 13, lineHeight: 18 },
  subLabel: { fontSize: 12, color: BrandColors.muted },
  warningBanner: {
    backgroundColor: '#FFF8E7',
    borderRadius: Radii.small,
    padding: Spacing.two,
    borderWidth: 1,
    borderColor: '#F5C400',
  },
  warningText: { color: '#7A5C00', fontSize: 13 },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d7dce3',
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#ffffff',
    minHeight: 44,
  },
  selectList: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.medium,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.border,
  },
  listItemSelected: { backgroundColor: '#EFF6FF' },
  listItemText: { flex: 1, fontSize: 15 },
  listItemTextSelected: { color: BrandColors.scoutyBlue, fontWeight: '600' },
  checkmark: { color: BrandColors.scoutyBlue, fontWeight: '700', marginLeft: Spacing.two },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    backgroundColor: '#eef3ff',
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: BrandColors.scoutyBlue },
  chipText: { color: '#334155', fontWeight: '600', fontSize: 14 },
  chipTextSelected: { color: '#ffffff' },
  anyLanguageBadge: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    backgroundColor: '#eef3ff',
  },
  anyLanguageText: { color: '#334155', fontWeight: '600', fontSize: 14 },
  selectedLanguageList: { gap: Spacing.one },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: Spacing.two,
    backgroundColor: '#EFF6FF',
    borderRadius: Radii.small,
    minHeight: 44,
    gap: Spacing.one,
  },
  languageRowText: { flex: 1, fontSize: 14, fontWeight: '500' },
  languageRowActions: { flexDirection: 'row', gap: 4 },
  moveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveBtnDisabled: { opacity: 0.3 },
  moveBtnText: { fontSize: 14, fontWeight: '700', color: BrandColors.scoutyBlue },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { fontSize: 14, fontWeight: '700', color: '#b42318' },
  radioGroup: { gap: Spacing.one },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radii.small,
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  radioItemSelected: { backgroundColor: '#EFF6FF', borderColor: BrandColors.scoutyBlue },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: { borderColor: BrandColors.scoutyBlue },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BrandColors.scoutyBlue },
  radioLabel: { fontSize: 15 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  primaryButton: {
    flex: 1,
    minWidth: 160,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    minHeight: 52,
    backgroundColor: BrandColors.scoutyBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  buttonDisabled: { opacity: 0.65 },
  secondaryButton: {
    flex: 1,
    minWidth: 120,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    minHeight: 52,
    backgroundColor: '#eef3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#334155', fontWeight: '600', fontSize: 16 },
  successText: { textAlign: 'center', fontSize: 14 },
  errorText: { color: '#b42318', fontSize: 14 },
});
