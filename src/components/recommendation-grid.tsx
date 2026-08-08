import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { RecommendationCard } from '@/components/recommendation-card';
import { ThemedText } from '@/components/themed-text';
import { BrandColors, Radii } from '@/constants/theme';
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
  const scrollerRef = useRef<ScrollView | null>(null);
  const scrollXRef = useRef(0);
  const viewportWidthRef = useRef(0);
  const contentWidthRef = useRef(0);
  const [canScrollForward, setCanScrollForward] = useState(false);
  const gap = 12;
  const cardWidth = width >= 1440 ? 250 : width >= 1280 ? 230 : width >= 1024 ? 210 : width >= 768 ? 195 : 180;
  const scrollBy = cardWidth * 4;
  const isMobileCarousel = width < 1024;

  const updateCanScrollForward = useCallback(() => {
    setCanScrollForward(
      isMobileCarousel
      && contentWidthRef.current - viewportWidthRef.current - scrollXRef.current > 8,
    );
  }, [isMobileCarousel]);

  useEffect(() => {
    scrollXRef.current = 0;
    scrollerRef.current?.scrollTo({ x: 0, animated: false });
    updateCanScrollForward();
  }, [recommendations, width, updateCanScrollForward]);

  return (
    <View style={{ gap: 10 }}>
      {width >= 1024 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scroll recommendations left"
            style={{ minHeight: 44, borderRadius: 999, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1, borderColor: '#d4deef', backgroundColor: '#fff' }}
            onPress={() => {
              const nextX = Math.max(0, scrollXRef.current - scrollBy);
              scrollerRef.current?.scrollTo({ x: nextX, animated: true });
            }}
          >
            <ThemedText>Back</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scroll recommendations right"
            style={{ minHeight: 44, borderRadius: 999, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1, borderColor: '#d4deef', backgroundColor: '#fff' }}
            onPress={() => {
              const nextX = scrollXRef.current + scrollBy;
              scrollerRef.current?.scrollTo({ x: nextX, animated: true });
            }}
          >
            <ThemedText>Next</ThemedText>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.carouselWrap}>
        <ScrollView
          ref={scrollerRef}
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={{ flexDirection: 'row', gap, paddingBottom: 4 }}
          style={{ width: '100%' }}
          snapToInterval={cardWidth + gap}
          snapToAlignment="start"
          decelerationRate="fast"
          onLayout={(event) => {
            viewportWidthRef.current = event.nativeEvent.layout.width;
            updateCanScrollForward();
          }}
          onContentSizeChange={(contentWidth) => {
            contentWidthRef.current = contentWidth;
            updateCanScrollForward();
          }}
          onScroll={(event) => {
            scrollXRef.current = event.nativeEvent.contentOffset.x;
            updateCanScrollForward();
          }}
          scrollEventThrottle={16}
        >
          {recommendations.map((recommendation) => (
            <View key={`${recommendation.mediaType}:${recommendation.tmdbMovieId}`} style={{ width: cardWidth, minWidth: cardWidth }}>
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
        </ScrollView>
        {canScrollForward ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show more recommendations"
            style={({ pressed }) => [styles.moreButton, pressed && styles.moreButtonPressed]}
            onPress={() => {
              const nextX = scrollXRef.current + cardWidth + gap;
              scrollerRef.current?.scrollTo({ x: nextX, animated: true });
            }}
          >
            <ThemedText style={styles.moreIcon}>›</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carouselWrap: {
    position: 'relative',
  },
  moreButton: {
    position: 'absolute',
    right: 8,
    top: 112,
    width: 48,
    height: 48,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.midnight900,
    borderWidth: 2,
    borderColor: BrandColors.surface,
    boxShadow: '0 8px 22px rgba(7, 21, 47, 0.28)',
  },
  moreButtonPressed: {
    opacity: 0.78,
  },
  moreIcon: {
    color: BrandColors.surface,
    fontSize: 38,
    lineHeight: 40,
  },
});
