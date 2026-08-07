import { useWindowDimensions, Pressable, StyleSheet, View } from 'react-native';

import { FeedbackActions } from '@/components/feedback-actions';
import { MoviePoster } from '@/components/movie-poster';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Radii, Spacing } from '@/constants/theme';
import type { LibraryAction, LibraryStatus } from '@/types/library';
import type { MovieRecommendation } from '@/types/recommendations';

type RecommendationCardProps = {
  recommendation: MovieRecommendation;
  selectedAction?: 'like' | 'dislike' | 'watched';
  onAction: (action: 'like' | 'dislike' | 'watched', recommendation: MovieRecommendation) => void;
  onRemoveFeedback?: (recommendation: MovieRecommendation) => void;
  libraryStatus?: LibraryStatus | null;
  onLibraryAction?: (action: LibraryAction, recommendation: MovieRecommendation) => void;
  librarySubmitting?: boolean;
  libraryErrorMessage?: string | null;
  feedbackDisabled?: boolean;
  feedbackSubmitting?: boolean;
  feedbackErrorMessage?: string | null;
};

export function RecommendationCard({
  recommendation,
  selectedAction,
  onAction,
  onRemoveFeedback,
  libraryStatus,
  onLibraryAction,
  librarySubmitting,
  libraryErrorMessage,
  feedbackDisabled,
  feedbackSubmitting,
  feedbackErrorMessage,
}: RecommendationCardProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 1280;

  const metadata = [
    recommendation.releaseYear ? String(recommendation.releaseYear) : null,
    recommendation.runtimeMinutes ? `${recommendation.runtimeMinutes} min` : null,
  ].filter((v): v is string => Boolean(v));

  const providers = recommendation.providers.length ? recommendation.providers : ['No providers listed'];
  const genres = recommendation.genres.length ? recommendation.genres : ['Genre unavailable'];

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <MoviePoster title={recommendation.title} posterUrl={recommendation.posterUrl} rating={recommendation.tmdbRating} />

      <View style={styles.content}>
        <ThemedText type="smallBold" numberOfLines={2} style={[styles.title, isCompact && styles.titleCompact]}>
          {recommendation.title}
        </ThemedText>

        {metadata.length > 0 ? (
          <View style={styles.metaRow}>
            {metadata.map((item) => (
              <View key={item} style={styles.metaChip}>
                <ThemedText themeColor="textSecondary" style={styles.metaText}>
                  {item}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.chipRow}>
          {genres.slice(0, 3).map((genre) => (
            <View key={genre} style={styles.genreChip}>
              <ThemedText style={styles.genreText}>{genre}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.reasonBlock}>
          <ThemedText type="smallBold" style={styles.reasonLabel}>Why Scouty picked it</ThemedText>
          <ThemedText style={styles.explanation} numberOfLines={4}>{recommendation.explanation}</ThemedText>
        </View>

        <View style={styles.providerRow}>
          {providers.map((provider) => (
            <View key={provider} style={styles.providerChip}>
              <ThemedText style={styles.providerText}>{provider}</ThemedText>
            </View>
          ))}
        </View>

        {onLibraryAction ? (
          <View style={styles.librarySection}>
            <ThemedText type="smallBold" style={styles.libraryLabel}>Personal library</ThemedText>

            <View style={styles.libraryActionRow}>
              {libraryStatus === 'watchlist' ? (
                <>
                  <View style={[styles.libraryChip, styles.libraryChipActive]}>
                    <ThemedText style={styles.libraryChipText}>In watchlist</ThemedText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.libraryButton}
                    onPress={() => onLibraryAction('mark_watched', recommendation)}
                  >
                    <ThemedText style={styles.libraryButtonText}>Mark watched</ThemedText>
                  </Pressable>
                </>
              ) : null}

              {libraryStatus === 'watched' ? (
                <>
                  <View style={[styles.libraryChip, styles.libraryChipActiveWatched]}>
                    <ThemedText style={styles.libraryChipText}>Watched</ThemedText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.libraryButton}
                    onPress={() => onLibraryAction('mark_unwatched', recommendation)}
                  >
                    <ThemedText style={styles.libraryButtonText}>Move to watchlist</ThemedText>
                  </Pressable>
                </>
              ) : null}

              {!libraryStatus ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.libraryButton}
                    onPress={() => onLibraryAction('add_watchlist', recommendation)}
                  >
                    <ThemedText style={styles.libraryButtonText}>Save to watchlist</ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.libraryButton}
                    onPress={() => onLibraryAction('mark_watched', recommendation)}
                  >
                    <ThemedText style={styles.libraryButtonText}>Mark watched</ThemedText>
                  </Pressable>
                </>
              ) : null}
            </View>

            {libraryStatus ? (
              <Pressable
                accessibilityRole="button"
                style={styles.libraryRemoveButton}
                onPress={() => onLibraryAction('remove', recommendation)}
              >
                <ThemedText style={styles.libraryRemoveText}>Remove from library</ThemedText>
              </Pressable>
            ) : null}

            {librarySubmitting ? (
              <ThemedText themeColor="textSecondary" style={styles.libraryHint}>Saving library state...</ThemedText>
            ) : null}
            {libraryErrorMessage ? (
              <ThemedText style={styles.libraryError}>{libraryErrorMessage}</ThemedText>
            ) : null}
          </View>
        ) : null}

        <FeedbackActions
          selectedAction={selectedAction}
          onAction={(action) => onAction(action, recommendation)}
          onRemove={onRemoveFeedback ? () => onRemoveFeedback(recommendation) : undefined}
          disabled={feedbackDisabled}
          submitting={feedbackSubmitting}
          errorMessage={feedbackErrorMessage}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    flexDirection: 'column',
    gap: Spacing.two,
    padding: Spacing.two,
    borderWidth: 1,
    borderColor: BrandColors.border,
    boxShadow: '0 10px 30px rgba(11, 22, 51, 0.08)',
    minWidth: 0,
  },
  content: {
    gap: Spacing.two,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    color: BrandColors.midnight900,
  },
  titleCompact: {
    fontSize: 16,
    lineHeight: 21,
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
    fontSize: 12,
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
  reasonBlock: {
    gap: Spacing.one,
  },
  reasonLabel: {
    color: BrandColors.scoutyBlue,
  },
  explanation: {
    fontSize: 13,
    lineHeight: 18,
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
  librarySection: {
    gap: Spacing.one,
  },
  libraryLabel: {
    color: BrandColors.midnight900,
  },
  libraryActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  libraryChip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    backgroundColor: '#eef3ff',
  },
  libraryChipActive: {
    backgroundColor: '#dbeafe',
  },
  libraryChipActiveWatched: {
    backgroundColor: '#dcfce7',
  },
  libraryChipText: {
    color: BrandColors.midnight800,
    fontSize: 12,
    fontWeight: '600',
  },
  libraryButton: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: '#ffffff',
  },
  libraryButtonText: {
    color: BrandColors.midnight900,
    fontSize: 12,
    fontWeight: '600',
  },
  libraryRemoveButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    backgroundColor: '#fee2e2',
  },
  libraryRemoveText: {
    color: '#b42318',
    fontSize: 12,
    fontWeight: '600',
  },
  libraryHint: {
    fontSize: 12,
  },
  libraryError: {
    color: '#b42318',
    fontSize: 12,
  },
});
