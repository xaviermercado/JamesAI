import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { useAuthSession } from '@/components/auth-session-provider';
import { HeroRecommendationForm } from '@/components/hero-recommendation-form';
import { RecommendationGrid } from '@/components/recommendation-grid';
import { ScoutyStateMessage } from '@/components/scouty-state-message';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ENGINE_CREDIT } from '@/constants/brand';
import { BrandColors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { getMyPreferences } from '@/services/profile-api';
import { getRecommendations } from '@/services/recommendations-api';
import type { MediaType, MovieRecommendation, RecommendationRequest, RecommendationResponse } from '@/types/recommendations';
import type { UserPreferences } from '@/types/profile';

type FeedbackAction = 'like' | 'dislike' | 'watched';

export default function HomeScreen() {
  const { status } = useAuthSession();

  const [description, setDescription] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('movie');
  const [maxRuntime, setMaxRuntime] = useState('');
  // Temporary filter overrides — start empty so server applies saved preferences by default.
  const [countryOverride, setCountryOverride] = useState('');
  const [streamingServices, setStreamingServices] = useState('');
  // null = inherit saved preference; [] = explicit "any language"
  const [languageOverride, setLanguageOverride] = useState<string[] | null>(null);

  const [savedPrefs, setSavedPrefs] = useState<UserPreferences | null>(null);
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>([]);
  const [lastResult, setLastResult] = useState<RecommendationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackById, setFeedbackById] = useState<Record<number, FeedbackAction>>({});

  // Abort controller to cancel stale in-flight requests.
  const abortRef = useRef<AbortController | null>(null);

  // Load saved preferences for authenticated users.
  useEffect(() => {
    if (status !== 'authenticated') return;

    let active = true;
    void getMyPreferences()
      .then((prefs) => {
        if (active) setSavedPrefs(prefs);
      })
      .catch(() => {
        // Non-fatal: preferences unavailable, continue anonymously.
      });

    return () => { active = false; };
  }, [status]);

  const submitRequest = async () => {
    if (!description.trim()) {
      setError('Tell Scouty a little about what you want to watch first.');
      setHasSearched(true);
      return;
    }

    // Cancel any previous in-flight request.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    const request: RecommendationRequest = {
      description,
      mediaType,
      maxRuntime: maxRuntime ? Number(maxRuntime) : undefined,
      // Temporary market: pass only if user typed something (server uses saved market when absent).
      country: countryOverride.trim() || undefined,
      // Temporary language: pass if explicitly overridden (null = inherit saved from server).
      originalLanguages: languageOverride ?? undefined,
      excludedMovieIds: recommendations.map((item) => item.tmdbMovieId),
    };

    // Streaming services: if user typed provider names → use legacy names.
    // If field is empty → pass nothing so server uses saved provider IDs.
    const serviceNames = streamingServices.split(',').map((s) => s.trim()).filter(Boolean);
    if (serviceNames.length > 0) {
      request.streamingServices = serviceNames;
    }

    try {
      const result = await getRecommendations(request);
      if (!controller.signal.aborted) {
        setRecommendations(result.recommendations);
        setLastResult(result);
      }
    } catch (nextError) {
      if (!controller.signal.aborted) {
        setError(nextError instanceof Error ? nextError.message : 'Scouty hit a snag while searching. Please try again.');
        setRecommendations([]);
        setLastResult(null);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  const handleAction = (action: FeedbackAction, recommendation: MovieRecommendation) => {
    setFeedbackById((current) => ({ ...current, [recommendation.tmdbMovieId]: action }));
  };

  const clearFilters = () => {
    setMediaType('movie');
    setMaxRuntime('');
    setCountryOverride('');
    setStreamingServices('');
    setLanguageOverride(null);
  };

  // Build a human-readable summary of which saved preferences are active.
  const savedPrefSummary = (() => {
    if (status !== 'authenticated' || !savedPrefs) return null;
    const parts: string[] = [];
    if (savedPrefs.marketCode && !countryOverride.trim()) {
      parts.push(savedPrefs.marketCode);
    }
    if (savedPrefs.streamingServices.length > 0 && !streamingServices.trim()) {
      parts.push(`${savedPrefs.streamingServices.length} service${savedPrefs.streamingServices.length === 1 ? '' : 's'}`);
    }
    if (savedPrefs.contentLanguages.length > 0 && languageOverride === null) {
      parts.push(`${savedPrefs.contentLanguages.length} language${savedPrefs.contentLanguages.length === 1 ? '' : 's'}`);
    }
    if (parts.length === 0) return null;
    return `Using your saved preferences: ${parts.join(', ')}`;
  })();

  return (
    <ThemedView style={styles.container}>
      <AppHeader />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.mainColumn}>
            <HeroRecommendationForm
              description={description}
              mediaType={mediaType}
              maxRuntime={maxRuntime}
              country={countryOverride}
              streamingServices={streamingServices}
              languageOverride={languageOverride}
              savedPrefSummary={savedPrefSummary}
              hasSavedLanguages={Boolean(savedPrefs?.contentLanguages.length)}
              onDescriptionChange={setDescription}
              onMediaTypeChange={setMediaType}
              onMaxRuntimeChange={setMaxRuntime}
              onCountryChange={setCountryOverride}
              onStreamingServicesChange={setStreamingServices}
              onLanguageOverrideChange={setLanguageOverride}
              onClearFilters={clearFilters}
              onSubmit={() => void submitRequest()}
              isLoading={isLoading}
            />

            {!hasSearched ? (
              <ScoutyStateMessage title="Scouty is ready when you are." body="Share your mood or occasion and Scouty will start scouting for tonight's movie." />
            ) : null}

            {error ? (
              <View style={styles.stateStack}>
                <ScoutyStateMessage title="Scouty hit a snag." body="We couldn't finish your search this time. Check your prompt or try again in a moment." tone="error" />
                <Pressable accessibilityRole="button" accessibilityLabel="Retry recommendation search" style={styles.retryButton} onPress={() => void submitRequest()}>
                  <ThemedText style={styles.retryText}>Retry</ThemedText>
                </Pressable>
              </View>
            ) : null}

            {isLoading && recommendations.length === 0 ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color={BrandColors.scoutyBlue} />
                <ThemedText type="smallBold">Scouty is searching...</ThemedText>
                <ThemedText themeColor="textSecondary">Pulling together the closest matches for your mood.</ThemedText>
              </View>
            ) : null}

            {hasSearched && !isLoading && !error && recommendations.length === 0 ? (
              <ScoutyStateMessage title="No close matches yet." body="Try broadening the mood, removing a filter, or giving Scouty a different angle." />
            ) : null}

            {recommendations.length > 0 ? (
              <View style={styles.resultsSection}>
                <View style={styles.resultsHeader}>
                  <ThemedText type="subtitle">Scouty found these for you</ThemedText>
                  {lastResult?.preferencesApplied ? (
                    <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite" style={styles.prefNotice}>
                      Recommendations reflect your saved preferences.
                    </ThemedText>
                  ) : null}
                  {isLoading ? <ThemedText themeColor="textSecondary">Refreshing your picks...</ThemedText> : null}
                </View>
                <RecommendationGrid recommendations={recommendations} feedbackById={feedbackById} onAction={handleAction} />
              </View>
            ) : null}

            <View style={styles.howSection}>
              <ThemedText type="subtitle">How Scouty picks</ThemedText>
              <View style={styles.howGrid}>
                <ThemedView type="backgroundElement" style={styles.howCard}>
                  <ThemedText type="smallBold">Mood first</ThemedText>
                  <ThemedText themeColor="textSecondary">Scouty reads your prompt in plain language and uses the current filter settings you choose.</ThemedText>
                </ThemedView>
                <ThemedView type="backgroundElement" style={styles.howCard}>
                  <ThemedText type="smallBold">Real catalogue data</ThemedText>
                  <ThemedText themeColor="textSecondary">Recommendations use live TMDB content details and provider information when available.</ThemedText>
                </ThemedView>
                <ThemedView type="backgroundElement" style={styles.howCard}>
                  <ThemedText type="smallBold">Powered by JamesAI</ThemedText>
                  <ThemedText themeColor="textSecondary">{ENGINE_CREDIT}</ThemedText>
                </ThemedView>
              </View>
            </View>
          </View>

          <AppFooter />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  contentContainer: { paddingBottom: Spacing.five },
  mainColumn: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  stateStack: { gap: Spacing.two },
  retryButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    borderRadius: Radii.pill,
    backgroundColor: BrandColors.scoutyBlue,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  retryText: { color: BrandColors.surface, fontWeight: '700' },
  loadingCard: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    gap: Spacing.two,
    alignItems: 'center',
  },
  resultsSection: { gap: Spacing.three },
  resultsHeader: { gap: Spacing.one },
  prefNotice: { fontSize: 13 },
  howSection: { gap: Spacing.three },
  howGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  howCard: {
    flexBasis: 260,
    flexGrow: 1,
    borderRadius: Radii.large,
    padding: Spacing.three,
    minWidth: 0,
    gap: Spacing.one,
  },
});
