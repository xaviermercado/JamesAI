import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
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
import { getMyFeedback, removeMyFeedback, submitMyFeedback } from '@/services/feedback-api';
import { getMyLibraryStates, updateMyLibraryAction } from '@/services/library-api';
import { getMyPreferences } from '@/services/profile-api';
import { getRecommendations } from '@/services/recommendations-api';
import { analytics, countBucket, responseTimeBucket, resultCountBucket } from '@/services/analytics';
import type { LibraryAction, LibraryStatus } from '@/types/library';
import type { MediaType, MovieRecommendation, RecommendationRequest, RecommendationResponse } from '@/types/recommendations';
import type { UserPreferences } from '@/types/profile';

type FeedbackAction = 'like' | 'dislike' | 'watched';

export default function HomeScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { status, csrfToken } = useAuthSession();

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
  const [feedbackByKey, setFeedbackByKey] = useState<Record<string, FeedbackAction>>({});
  const [feedbackSubmittingByKey, setFeedbackSubmittingByKey] = useState<Record<string, boolean>>({});
  const [feedbackErrorByKey, setFeedbackErrorByKey] = useState<Record<string, string | null>>({});
  const [libraryStatusByKey, setLibraryStatusByKey] = useState<Record<string, LibraryStatus | null>>({});
  const [librarySubmittingByKey, setLibrarySubmittingByKey] = useState<Record<string, boolean>>({});
  const [libraryErrorByKey, setLibraryErrorByKey] = useState<Record<string, string | null>>({});

  // Abort controller to cancel stale in-flight requests.
  const abortRef = useRef<AbortController | null>(null);
  const feedbackRequestVersionRef = useRef<Record<string, number>>({});
  const libraryRequestVersionRef = useRef<Record<string, number>>({});

  const feedbackKeyFor = (item: Pick<MovieRecommendation, 'tmdbMovieId' | 'mediaType'>) =>
    `${item.mediaType}:${item.tmdbMovieId}`;

  const libraryKeyFor = (item: Pick<MovieRecommendation, 'tmdbMovieId' | 'mediaType'>) =>
    `${item.mediaType}:${item.tmdbMovieId}`;

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

  useEffect(() => {
    if (status !== 'authenticated') {
      setLibraryStatusByKey({});
      setLibraryErrorByKey({});
      return;
    }

    if (recommendations.length === 0) {
      setLibraryStatusByKey({});
      return;
    }

    let active = true;
    const titles = recommendations.map((item) => ({
      tmdbId: item.tmdbMovieId,
      mediaType: item.mediaType,
    }));

    void getMyLibraryStates(titles)
      .then((response) => {
        if (!active) return;
        const next: Record<string, LibraryStatus | null> = {};
        for (const state of response.states) {
          next[`${state.mediaType}:${state.tmdbId}`] = state.status;
        }
        setLibraryStatusByKey(next);
      })
      .catch(() => {
        if (!active) return;
        setLibraryStatusByKey({});
      });

    return () => {
      active = false;
    };
  }, [recommendations, status]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    let active = true;
    setFeedbackByKey({});
    setFeedbackErrorByKey({});

    void getMyFeedback()
      .then((response) => {
        if (!active) return;
        const next: Record<string, FeedbackAction> = {};
        for (const item of response.feedback) {
          const action = item.feedbackType === 'liked'
            ? 'like'
            : item.feedbackType === 'disliked'
              ? 'dislike'
              : 'watched';
          next[`${item.mediaType}:${item.tmdbId}`] = action;
        }
        setFeedbackByKey(next);
      })
      .catch(() => {
        if (!active) return;
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

    const startedAt = Date.now();
    try {
      const result = await getRecommendations(request);
      if (!controller.signal.aborted) {
        setRecommendations(result.recommendations);
        setLastResult(result);
        const providerCount = serviceNames.length || result.preferenceContext?.providerCount || 0;
        const languageCount = languageOverride?.length ?? result.preferenceContext?.languageCount ?? 0;
        analytics.track('search', {
          media_type: mediaType,
          genre_count: '0',
          provider_count: countBucket(providerCount),
          language_count: countBucket(languageCount),
          authenticated: status === 'authenticated',
        });
        analytics.track('recommendations_viewed', {
          result_count_bucket: resultCountBucket(result.recommendations.length),
          response_time_bucket: responseTimeBucket(Date.now() - startedAt),
        });
        if (mediaType !== 'movie') analytics.track('filter_applied', { filter_category: 'media_type', selected_count_bucket: '1' });
        if (maxRuntime) analytics.track('filter_applied', { filter_category: 'runtime', selected_count_bucket: '1' });
        if (countryOverride.trim()) analytics.track('filter_applied', { filter_category: 'market', selected_count_bucket: '1' });
        if (serviceNames.length) analytics.track('filter_applied', { filter_category: 'provider', selected_count_bucket: countBucket(serviceNames.length) });
        if (languageOverride !== null) analytics.track('filter_applied', { filter_category: 'language', selected_count_bucket: countBucket(languageOverride.length) });
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

  const persistFeedback = async (
    nextAction: FeedbackAction | null,
    recommendation: MovieRecommendation,
  ) => {
    const key = feedbackKeyFor(recommendation);
    const previous = feedbackByKey[key];

    setFeedbackByKey((current) => {
      const next = { ...current };
      if (nextAction === null) {
        delete next[key];
      } else {
        next[key] = nextAction;
      }
      return next;
    });
    setFeedbackErrorByKey((current) => ({ ...current, [key]: null }));
    setFeedbackSubmittingByKey((current) => ({ ...current, [key]: true }));

    const nextVersion = (feedbackRequestVersionRef.current[key] ?? 0) + 1;
    feedbackRequestVersionRef.current[key] = nextVersion;

    try {
      if (nextAction === null) {
        await removeMyFeedback(recommendation.tmdbMovieId, recommendation.mediaType, csrfToken);
      } else {
        const feedbackType = nextAction === 'like'
          ? 'liked'
          : nextAction === 'dislike'
            ? 'disliked'
            : 'watched';

        await submitMyFeedback(
          {
            tmdbId: recommendation.tmdbMovieId,
            mediaType: recommendation.mediaType,
            feedbackType,
            genres: recommendation.genres.slice(0, 3),
            originalLanguage: recommendation.originalLanguage,
            recommendationRequestId: lastResult?.recommendationRequestId,
          },
          csrfToken,
        );
        if (nextAction === 'like' || nextAction === 'dislike') {
          analytics.track('feedback_submitted', { feedback_category: nextAction === 'like' ? 'positive' : 'negative' });
        }
      }
    } catch (nextError) {
      if (feedbackRequestVersionRef.current[key] === nextVersion) {
        setFeedbackByKey((current) => {
          const next = { ...current };
          if (previous === undefined) {
            delete next[key];
          } else {
            next[key] = previous;
          }
          return next;
        });
        setFeedbackErrorByKey((current) => ({
          ...current,
          [key]: nextError instanceof Error ? nextError.message : 'Unable to save feedback right now.',
        }));
      }
    } finally {
      if (feedbackRequestVersionRef.current[key] === nextVersion) {
        setFeedbackSubmittingByKey((current) => ({ ...current, [key]: false }));
      }
    }
  };

  const handleAction = (action: FeedbackAction, recommendation: MovieRecommendation) => {
    const key = feedbackKeyFor(recommendation);
    const current = feedbackByKey[key];

    if (status !== 'authenticated' || !csrfToken) {
      setFeedbackByKey((prev) => ({ ...prev, [key]: action }));
      return;
    }

    const nextAction = current === action ? null : action;
    void persistFeedback(nextAction, recommendation);
  };

  const handleRemoveFeedback = (recommendation: MovieRecommendation) => {
    if (status !== 'authenticated' || !csrfToken) {
      const key = feedbackKeyFor(recommendation);
      setFeedbackByKey((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    void persistFeedback(null, recommendation);
  };

  const clearFilters = () => {
    setMediaType('movie');
    setMaxRuntime('');
    setCountryOverride('');
    setStreamingServices('');
    setLanguageOverride(null);
  };

  const persistLibraryState = async (action: LibraryAction, recommendation: MovieRecommendation) => {
    const key = libraryKeyFor(recommendation);
    const previous = libraryStatusByKey[key] ?? null;

    setLibraryErrorByKey((current) => ({ ...current, [key]: null }));
    setLibrarySubmittingByKey((current) => ({ ...current, [key]: true }));

    const nextVersion = (libraryRequestVersionRef.current[key] ?? 0) + 1;
    libraryRequestVersionRef.current[key] = nextVersion;

    // Optimistic state for responsive controls.
    setLibraryStatusByKey((current) => ({
      ...current,
      [key]: action === 'remove' ? null : action === 'mark_watched' ? 'watched' : 'watchlist',
    }));

    try {
      const response = await updateMyLibraryAction(
        {
          tmdbId: recommendation.tmdbMovieId,
          mediaType: recommendation.mediaType,
          action,
          recommendationRequestId: lastResult?.recommendationRequestId,
        },
        csrfToken,
      );

      if (libraryRequestVersionRef.current[key] === nextVersion) {
        setLibraryStatusByKey((current) => ({
          ...current,
          [key]: response.state?.status ?? null,
        }));
        if (action === 'add_watchlist' && response.state?.status === 'watchlist') {
          analytics.track('watchlist_added', { media_type: recommendation.mediaType, source_surface: 'recommendations' });
        }
      }
    } catch (nextError) {
      if (libraryRequestVersionRef.current[key] === nextVersion) {
        setLibraryStatusByKey((current) => ({
          ...current,
          [key]: previous,
        }));
        setLibraryErrorByKey((current) => ({
          ...current,
          [key]: nextError instanceof Error ? nextError.message : 'Unable to update your library right now.',
        }));
      }
    } finally {
      if (libraryRequestVersionRef.current[key] === nextVersion) {
        setLibrarySubmittingByKey((current) => ({ ...current, [key]: false }));
      }
    }
  };

  const handleLibraryAction = (action: LibraryAction, recommendation: MovieRecommendation) => {
    if (status !== 'authenticated' || !csrfToken) {
      router.push(`/login?redirectTo=${encodeURIComponent(pathname || '/')}`);
      return;
    }

    void persistLibraryState(action, recommendation);
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

  const feedbackById = Object.fromEntries(
    recommendations.map((item) => [item.tmdbMovieId, feedbackByKey[feedbackKeyFor(item)]]),
  ) as Record<number, FeedbackAction>;

  const feedbackSubmittingById = Object.fromEntries(
    recommendations.map((item) => [item.tmdbMovieId, Boolean(feedbackSubmittingByKey[feedbackKeyFor(item)])]),
  ) as Record<number, boolean>;

  const feedbackErrorById = Object.fromEntries(
    recommendations.map((item) => [item.tmdbMovieId, feedbackErrorByKey[feedbackKeyFor(item)] ?? null]),
  ) as Record<number, string | null>;

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
                  {lastResult?.feedbackPersonalizationApplied ? (
                    <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite" style={styles.prefNotice}>
                      Also informed by your feedback.
                    </ThemedText>
                  ) : null}
                  {isLoading ? <ThemedText themeColor="textSecondary">Refreshing your picks...</ThemedText> : null}
                </View>
                {status === 'authenticated' ? (
                  <ThemedText themeColor="textSecondary" style={styles.prefNotice}>
                    Your feedback can improve future recommendations. It won&apos;t change your saved preferences.
                  </ThemedText>
                ) : null}
                <RecommendationGrid
                  recommendations={recommendations}
                  feedbackById={feedbackById}
                  onAction={handleAction}
                  onRemoveFeedback={handleRemoveFeedback}
                  libraryStatusByKey={libraryStatusByKey}
                  onLibraryAction={handleLibraryAction}
                  librarySubmittingByKey={librarySubmittingByKey}
                  libraryErrorByKey={libraryErrorByKey}
                  feedbackSubmittingById={feedbackSubmittingById}
                  feedbackErrorById={feedbackErrorById}
                />
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
