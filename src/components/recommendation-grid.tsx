import { useWindowDimensions, View } from 'react-native';

import { RecommendationCard } from '@/components/recommendation-card';
import type { LibraryAction, LibraryStatus } from '@/types/library';
import type { MovieRecommendation } from '@/types/recommendations';

type FeedbackAction = 'like' | 'dislike' | 'watched';

interface RecommendationGridProps {
  recommendations: MovieRecommendation[];
  feedbackById: Record<number, FeedbackAction>;
  onAction: (action: FeedbackAction, recommendation: MovieRecommendation) => void;
  onRemoveFeedback?: (recommendation: MovieRecommendation) => void;
  libraryStatusByKey?: Record<string, LibraryStatus | null>;
  onLibraryAction?: (action: LibraryAction, recommendation: MovieRecommendation) => void;
  librarySubmittingByKey?: Record<string, boolean>;
  libraryErrorByKey?: Record<string, string | null>;
  feedbackSubmittingById?: Record<number, boolean>;
  feedbackErrorById?: Record<number, string | null>;
  feedbackDisabled?: boolean;
}

export function RecommendationGrid({
  recommendations,
  feedbackById,
  onAction,
  onRemoveFeedback,
  libraryStatusByKey,
  onLibraryAction,
  librarySubmittingByKey,
  libraryErrorByKey,
  feedbackSubmittingById,
  feedbackErrorById,
  feedbackDisabled,
}: RecommendationGridProps) {
  const { width } = useWindowDimensions();
  const gap = 24;
  // Outer mainColumn has 24px padding on each side.
  const containerPadding = 48;
  const availableWidth = Math.max(width - containerPadding, 280);
  const columns = availableWidth >= 1300 ? 4 : availableWidth >= 860 ? 2 : 1;
  const cardWidth = columns === 1
    ? availableWidth
    : Math.floor((availableWidth - gap * (columns - 1)) / columns);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {recommendations.map((recommendation) => (
        <View key={`${recommendation.mediaType}:${recommendation.tmdbMovieId}`} style={{ width: cardWidth, minWidth: 0 }}>
          <RecommendationCard
            recommendation={recommendation}
            selectedAction={feedbackById[recommendation.tmdbMovieId]}
            onAction={onAction}
            onRemoveFeedback={onRemoveFeedback}
            libraryStatus={libraryStatusByKey?.[`${recommendation.mediaType}:${recommendation.tmdbMovieId}`] ?? null}
            onLibraryAction={onLibraryAction}
            librarySubmitting={Boolean(librarySubmittingByKey?.[`${recommendation.mediaType}:${recommendation.tmdbMovieId}`])}
            libraryErrorMessage={libraryErrorByKey?.[`${recommendation.mediaType}:${recommendation.tmdbMovieId}`] ?? null}
            feedbackSubmitting={Boolean(feedbackSubmittingById?.[recommendation.tmdbMovieId])}
            feedbackErrorMessage={feedbackErrorById?.[recommendation.tmdbMovieId] ?? null}
            feedbackDisabled={feedbackDisabled}
          />
        </View>
      ))}
    </View>
  );
}