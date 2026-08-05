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
  const columns = width >= 1380 ? 4 : width >= 920 ? 2 : width >= 560 ? 2 : 1;
  const gap = 24;
  const availableWidth = Math.max(width - 64, 320);
  const cardWidth = columns === 1 ? availableWidth : (availableWidth - gap * (columns - 1)) / columns;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {recommendations.map((recommendation) => (
        <View key={recommendation.tmdbMovieId} style={{ width: cardWidth, minWidth: columns === 1 ? undefined : 250 }}>
          <RecommendationCard recommendation={recommendation} selectedAction={feedbackById[recommendation.tmdbMovieId]} onAction={onAction} />
        </View>
      ))}
    </View>
  );
}