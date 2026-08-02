import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecommendationCard } from '@/components/recommendation-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getHealthStatus } from '@/services/health-api';
import { getRecommendations } from '@/services/recommendations-api';
import type { MediaType, MovieRecommendation, RecommendationRequest } from '@/types/recommendations';

type FeedbackAction = 'like' | 'dislike' | 'watched';

export default function HomeScreen() {
  const [description, setDescription] = useState('Something funny but not stupid, under two hours, preferably from the 90s, for a date night.');
  const [mediaType, setMediaType] = useState<MediaType>('movie');
  const [maxRuntime, setMaxRuntime] = useState('');
  const [country, setCountry] = useState('');
  const [streamingServices, setStreamingServices] = useState('');
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [feedbackById, setFeedbackById] = useState<Record<number, FeedbackAction>>({});
  const [page, setPage] = useState(0);
  const [healthStatus, setHealthStatus] = useState<'ok' | 'error'>('error');
  const advancedHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loadHealthStatus = async () => {
      const status = await getHealthStatus();
      setHealthStatus(status.status);
    };

    loadHealthStatus();
    const interval = setInterval(loadHealthStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Animated.timing(advancedHeight, {
      toValue: showAdvancedFilters ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [advancedHeight, showAdvancedFilters]);

  const submitRequest = async (nextPage = 0) => {
    if (!description.trim()) {
      setError('Please describe what you want to watch.');
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
      setPage(nextPage);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to load recommendations.');
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (action: FeedbackAction, recommendation: MovieRecommendation) => {
    setFeedbackById((current) => ({ ...current, [recommendation.tmdbMovieId]: action }));
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.heroCard}>
            <ThemedText type="title" style={styles.title}>
              JamesAI
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Describe the mood, vibe, or occasion and we will surface five movies that feel right.
            </ThemedText>

            <ThemedView
              type="backgroundElement"
              style={[styles.statusBanner, healthStatus === 'ok' ? styles.statusBannerOk : styles.statusBannerError]}>
              <ThemedText style={styles.statusText}>
                {healthStatus === 'ok' ? 'Backend online' : 'Backend unavailable'}
              </ThemedText>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.formCard}>
              <ThemedText type="smallBold">What are you in the mood for?</ThemedText>
              <TextInput
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
                placeholder="Try: Something funny but not stupid, under two hours, for a date night."
                placeholderTextColor="#8a8f98"
                style={styles.textInput}
              />

              <Pressable
                style={styles.advancedToggle}
                onPress={() => setShowAdvancedFilters((current) => !current)}>
                <ThemedText type="smallBold">Advanced search</ThemedText>
                <ThemedText style={styles.advancedToggleText}>{showAdvancedFilters ? '−' : '+'}</ThemedText>
              </Pressable>

              <Animated.View
                style={{
                  overflow: 'hidden',
                  maxHeight: advancedHeight.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 260],
                  }),
                  opacity: advancedHeight.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                }}>
                <View style={styles.filterGrid}>
                  <View style={styles.filterGroup}>
                    <ThemedText type="smallBold">Media</ThemedText>
                    <View style={styles.pillRow}>
                      <Pressable
                        style={[styles.pill, mediaType === 'movie' && styles.pillActive]}
                        onPress={() => setMediaType('movie')}>
                        <ThemedText style={[styles.pillText, mediaType === 'movie' && styles.pillTextActive]}>
                          Movies
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.pill, mediaType === 'tv' && styles.pillActive]}
                        onPress={() => setMediaType('tv')}>
                        <ThemedText style={[styles.pillText, mediaType === 'tv' && styles.pillTextActive]}>
                          TV
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.filterGroup}>
                    <ThemedText type="smallBold">Max runtime (min)</ThemedText>
                    <TextInput
                      value={maxRuntime}
                      onChangeText={setMaxRuntime}
                      placeholder="120"
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.filterGroup}>
                    <ThemedText type="smallBold">Country</ThemedText>
                    <TextInput
                      value={country}
                      onChangeText={setCountry}
                      placeholder="United States"
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.filterGroup}>
                    <ThemedText type="smallBold">Streaming services</ThemedText>
                    <TextInput
                      value={streamingServices}
                      onChangeText={setStreamingServices}
                      placeholder="Netflix, Max"
                      style={styles.input}
                    />
                  </View>
                </View>
              </Animated.View>

              <Pressable style={styles.primaryButton} onPress={() => submitRequest(0)}>
                <ThemedText style={styles.primaryButtonText}>Find something to watch</ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>

          {isLoading ? (
            <ThemedView type="backgroundElement" style={styles.stateCard}>
              <ActivityIndicator size="large" color="#3c87f7" />
              <ThemedText style={styles.stateText}>Finding the perfect fit…</ThemedText>
            </ThemedView>
          ) : null}

          {!isLoading && error ? (
            <ThemedView type="backgroundElement" style={styles.stateCard}>
              <ThemedText style={styles.stateText}>{error}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.stateHint}>
                The backend may be unavailable or still needs a TMDB token.
              </ThemedText>
              <Pressable style={styles.secondaryButton} onPress={() => submitRequest(0)}>
                <ThemedText style={styles.secondaryButtonText}>Try again</ThemedText>
              </Pressable>
            </ThemedView>
          ) : null}

          {!isLoading && hasSearched && !error && recommendations.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.stateCard}>
              <ThemedText style={styles.stateText}>No matches yet. Try broadening the prompt.</ThemedText>
            </ThemedView>
          ) : null}

          {!isLoading && recommendations.length > 0 ? (
            <View style={styles.resultsSection}>
              <ThemedText type="subtitle">Recommended for you</ThemedText>
              {recommendations.map((recommendation) => (
                <RecommendationCard
                  key={recommendation.tmdbMovieId}
                  recommendation={recommendation}
                  selectedAction={feedbackById[recommendation.tmdbMovieId]}
                  onAction={handleAction}
                />
              ))}

              <Pressable style={styles.secondaryButton} onPress={() => submitRequest(page + 1)}>
                <ThemedText style={styles.secondaryButtonText}>Give me five more</ThemedText>
              </Pressable>
            </View>
          ) : null}
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
    paddingBottom: Spacing.five,
  },
  contentContainer: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.four,
  },
  heroCard: {
    gap: Spacing.three,
  },
  title: {
    textAlign: Platform.select({ web: 'center' }) ?? 'left',
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 28,
    textAlign: Platform.select({ web: 'center' }) ?? 'left',
  },
  statusBanner: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignSelf: 'flex-start',
  },
  statusBannerOk: {
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
  },
  statusBannerError: {
    backgroundColor: 'rgba(248, 113, 113, 0.16)',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  formCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d7dce3',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    minHeight: 110,
    textAlignVertical: 'top',
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#d7dce3',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: '#f8fafc',
  },
  advancedToggleText: {
    marginLeft: Spacing.two,
    fontWeight: '700',
    color: '#3c87f7',
  },
  filterGrid: {
    gap: Spacing.three,
  },
  filterGroup: {
    gap: Spacing.two,
  },
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    backgroundColor: '#eef2f7',
  },
  pillActive: {
    backgroundColor: '#3c87f7',
  },
  pillText: {
    fontSize: 14,
    color: '#475467',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d7dce3',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  primaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    backgroundColor: '#3c87f7',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  stateCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  stateText: {
    textAlign: 'center',
    fontSize: 16,
  },
  stateHint: {
    textAlign: 'center',
    fontSize: 14,
  },
  resultsSection: {
    gap: Spacing.three,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    backgroundColor: '#111827',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
