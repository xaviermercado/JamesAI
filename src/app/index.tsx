import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { HeroRecommendationForm } from '@/components/hero-recommendation-form';
import { RecommendationGrid } from '@/components/recommendation-grid';
import { ScoutyStateMessage } from '@/components/scouty-state-message';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ENGINE_CREDIT } from '@/constants/brand';
import { BrandColors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { getRecommendations } from '@/services/recommendations-api';
import type { MediaType, MovieRecommendation, RecommendationRequest } from '@/types/recommendations';

type FeedbackAction = 'like' | 'dislike' | 'watched';

export default function HomeScreen() {
  const [description, setDescription] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('movie');
  const [maxRuntime, setMaxRuntime] = useState('');
  const [country, setCountry] = useState('');
  const [streamingServices, setStreamingServices] = useState('');
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackById, setFeedbackById] = useState<Record<number, FeedbackAction>>({});

  const submitRequest = async () => {
    if (!description.trim()) {
      setError('Tell Scouty a little about what you want to watch first.');
      setHasSearched(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    const request: RecommendationRequest = {
      description,
      mediaType,
      maxRuntime: maxRuntime ? Number(maxRuntime) : undefined,
      country: country || undefined,
      streamingServices: streamingServices
        .split(',')
        .map((service) => service.trim())
        .filter(Boolean),
      excludedMovieIds: recommendations.map((item) => item.tmdbMovieId),
    };

    try {
      const result = await getRecommendations(request);
      setRecommendations(result.recommendations);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Scouty hit a snag while searching. Please try again.');
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (action: FeedbackAction, recommendation: MovieRecommendation) => {
    setFeedbackById((current) => ({ ...current, [recommendation.tmdbMovieId]: action }));
  };

  const clearFilters = () => {
    setMediaType('movie');
    setMaxRuntime('');
    setCountry('');
    setStreamingServices('');
  };

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
              country={country}
              streamingServices={streamingServices}
              onDescriptionChange={setDescription}
              onMediaTypeChange={setMediaType}
              onMaxRuntimeChange={setMaxRuntime}
              onCountryChange={setCountry}
              onStreamingServicesChange={setStreamingServices}
              onClearFilters={clearFilters}
              onSubmit={() => void submitRequest()}
              isLoading={isLoading}
            />

            {!hasSearched ? (
              <ScoutyStateMessage title="Scouty is ready when you are." body="Share your mood or occasion and Scouty will start scouting for tonight’s movie." />
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
                <ThemedText type="smallBold">Scouty is searching…</ThemedText>
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
                  {isLoading ? <ThemedText themeColor="textSecondary">Refreshing your picks…</ThemedText> : null}
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
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: Spacing.five,
  },
  mainColumn: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  stateStack: {
    gap: Spacing.two,
  },
  retryButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    borderRadius: Radii.pill,
    backgroundColor: BrandColors.scoutyBlue,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  retryText: {
    color: BrandColors.surface,
    fontWeight: '700',
  },
  loadingCard: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    gap: Spacing.two,
    alignItems: 'center',
  },
  resultsSection: {
    gap: Spacing.three,
  },
  resultsHeader: {
    gap: Spacing.one,
  },
  howSection: {
    gap: Spacing.three,
  },
  howGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  howCard: {
    flexBasis: 280,
    flexGrow: 1,
    borderRadius: Radii.large,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
});
