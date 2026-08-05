import { StyleSheet, View } from 'react-native';

import { FeedbackActions } from '@/components/feedback-actions';
import { MoviePoster } from '@/components/movie-poster';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Radii, Spacing } from '@/constants/theme';
import type { MovieRecommendation } from '@/types/recommendations';

type RecommendationCardProps = {
  recommendation: MovieRecommendation;
  selectedAction?: string;
  onAction: (action: 'like' | 'dislike' | 'watched', recommendation: MovieRecommendation) => void;
};

export function RecommendationCard({
  recommendation,
  selectedAction,
  onAction,
}: RecommendationCardProps) {
  const metadata = [
    recommendation.releaseYear ? String(recommendation.releaseYear) : 'Unknown year',
    recommendation.runtimeMinutes ? `${recommendation.runtimeMinutes} min` : 'Runtime unavailable',
  ];

  const providers = recommendation.providers.length ? recommendation.providers : ['No providers listed'];
  const genres = recommendation.genres.length ? recommendation.genres : ['Genre unavailable'];

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <MoviePoster title={recommendation.title} posterUrl={recommendation.posterUrl} rating={recommendation.tmdbRating} />

      <View style={styles.content}>
        <ThemedText type="smallBold" style={styles.title}>
          {recommendation.title}
        </ThemedText>

        <View style={styles.metaRow}>
          {metadata.map((item) => (
            <View key={item} style={styles.metaChip}>
              <ThemedText themeColor="textSecondary" style={styles.metaText}>
                {item}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.chipRow}>
          {genres.slice(0, 3).map((genre) => (
            <View key={genre} style={styles.genreChip}>
              <ThemedText style={styles.genreText}>{genre}</ThemedText>
            </View>
          ))}
        </View>

        <ThemedText numberOfLines={4} themeColor="textSecondary" style={styles.overview}>{recommendation.explanation}</ThemedText>

        <View style={styles.reasonBlock}>
          <ThemedText type="smallBold" style={styles.reasonLabel}>Why Scouty picked it</ThemedText>
          <ThemedText style={styles.explanation}>{recommendation.explanation}</ThemedText>
        </View>

        <View style={styles.providerRow}>
          {providers.map((provider) => (
            <View key={provider} style={styles.providerChip}>
              <ThemedText style={styles.providerText}>{provider}</ThemedText>
            </View>
          ))}
        </View>

        <FeedbackActions selectedAction={selectedAction} onAction={(action) => onAction(action, recommendation)} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    flexDirection: 'column',
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: BrandColors.border,
    boxShadow: '0 10px 30px rgba(11, 22, 51, 0.08)',
  },
  content: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    color: BrandColors.midnight900,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  metaChip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    backgroundColor: '#eef3ff',
  },
  metaText: {
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  genreChip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    backgroundColor: '#edf4ff',
  },
  genreText: {
    fontSize: 12,
    color: BrandColors.midnight800,
  },
  overview: {
    fontSize: 15,
    lineHeight: 24,
  },
  reasonBlock: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  reasonLabel: {
    color: BrandColors.scoutyBlue,
  },
  explanation: {
    fontSize: 15,
    lineHeight: 22,
  },
  providerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  providerChip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  providerText: {
    fontSize: 12,
    color: BrandColors.midnight800,
  },
});
