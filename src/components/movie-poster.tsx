import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { BrandColors, Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

interface MoviePosterProps {
  title: string;
  posterUrl?: string | null;
  rating?: number;
}

export function MoviePoster({ title, posterUrl, rating }: MoviePosterProps) {
  const [hasError, setHasError] = useState(false);
  const showFallback = !posterUrl || hasError;

  return (
    <View style={styles.frame} accessible accessibilityLabel={`${title} poster`}>
      {showFallback ? (
        <View style={styles.fallback}>
          <ThemedText style={styles.fallbackText}>{title}</ThemedText>
        </View>
      ) : (
        <Image
          source={{ uri: posterUrl }}
          style={styles.image}
          contentFit="cover"
          transition={120}
          onError={() => setHasError(true)}
          accessibilityLabel={`${title} poster`}
        />
      )}
      {rating ? (
        <View style={styles.ratingBadge}>
          <ThemedText style={styles.ratingText}>★ {rating.toFixed(1)}</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: Radii.large,
    overflow: 'hidden',
    backgroundColor: '#dbe7ff',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
    backgroundColor: '#dbe7ff',
  },
  fallbackText: {
    textAlign: 'center',
    color: BrandColors.midnight900,
  },
  ratingBadge: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(11,22,51,0.82)',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  ratingText: {
    color: BrandColors.surface,
    fontSize: 13,
    fontWeight: '700',
  },
});