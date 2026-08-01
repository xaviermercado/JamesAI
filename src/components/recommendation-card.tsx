import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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
    recommendation.tmdbRating ? `${recommendation.tmdbRating.toFixed(1)}/10` : 'Rating unavailable',
  ];

  const providers = recommendation.providers.length ? recommendation.providers : ['No providers listed'];
  const genres = recommendation.genres.length ? recommendation.genres : ['Genre unavailable'];

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Image source={{ uri: recommendation.posterUrl || 'https://via.placeholder.com/500x750?text=Poster' }} style={styles.poster} contentFit="cover" />

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
          {genres.map((genre) => (
            <View key={genre} style={styles.genreChip}>
              <ThemedText style={styles.genreText}>{genre}</ThemedText>
            </View>
          ))}
        </View>

        <ThemedText style={styles.explanation}>{recommendation.explanation}</ThemedText>

        <View style={styles.providerRow}>
          {providers.map((provider) => (
            <View key={provider} style={styles.providerChip}>
              <ThemedText style={styles.providerText}>{provider}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[styles.actionButton, selectedAction === 'like' && styles.actionButtonActive]}
            onPress={() => onAction('like', recommendation)}>
            <ThemedText style={styles.actionText}>Like</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.actionButton, selectedAction === 'dislike' && styles.actionButtonActive]}
            onPress={() => onAction('dislike', recommendation)}>
            <ThemedText style={styles.actionText}>Not for me</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.actionButton, selectedAction === 'watched' && styles.actionButtonActive]}
            onPress={() => onAction('watched', recommendation)}>
            <ThemedText style={styles.actionText}>Already watched</ThemedText>
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
    flexDirection: 'column',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  poster: {
    width: '100%',
    height: 220,
    borderRadius: Spacing.two,
  },
  content: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 20,
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
    backgroundColor: 'rgba(17, 24, 39, 0.06)',
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
    backgroundColor: '#3c87f7',
  },
  genreText: {
    fontSize: 12,
    color: '#ffffff',
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
    backgroundColor: 'rgba(60, 135, 247, 0.12)',
  },
  providerText: {
    fontSize: 12,
    color: '#3c87f7',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  actionButton: {
    borderRadius: 999,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    backgroundColor: 'rgba(60, 135, 247, 0.12)',
  },
  actionButtonActive: {
    backgroundColor: '#3c87f7',
  },
  actionText: {
    fontSize: 13,
    color: '#3c87f7',
  },
});
