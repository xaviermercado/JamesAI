import { useWindowDimensions, View } from 'react-native';

import { RecommendationCard } from '@/components/recommendation-card';
import type { MovieRecommendation } from '@/types/recommendations';

type FeedbackAction = 'like' | 'dislike' | 'watched';

interface RecommendationGridProps {
  recommendations: MovieRecommendation[];
  feedbackById: Record<number, FeedbackAction>;
  onAction: (action: FeedbackAction, recommendation: MovieRecommendation) => void;
}

export function RecommendationGrid({ recommendations, feedbackById, onAction }: RecommendationGridProps) {
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
        <View key={recommendation.tmdbMovieId} style={{ width: cardWidth, minWidth: 0 }}>
          <RecommendationCard recommendation={recommendation} selectedAction={feedbackById[recommendation.tmdbMovieId]} onAction={onAction} />
        </View>
      ))}
    </View>
  );
}