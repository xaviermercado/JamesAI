export type FeedbackType = 'liked' | 'disliked' | 'watched';

export interface RecommendationFeedbackItem {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  feedbackType: FeedbackType;
  updatedAt: string;
}

export interface SubmitFeedbackInput {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  feedbackType: FeedbackType;
  genres?: string[];
  originalLanguage?: string;
  recommendationRequestId?: string;
}
