import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { scoutyHeroMascot } from '@/constants/brand';
import { BrandColors, Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

interface ScoutyStateMessageProps {
  title: string;
  body: string;
  tone?: 'neutral' | 'error';
}

export function ScoutyStateMessage({ title, body, tone = 'neutral' }: ScoutyStateMessageProps) {
  return (
    <ThemedView type="backgroundElement" style={[styles.card, tone === 'error' && styles.cardError]}>
      <Image source={scoutyHeroMascot} style={styles.mascot} contentFit="contain" accessibilityLabel="Scouty mascot" />
      <View style={styles.copy}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText themeColor="textSecondary">{body}</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  cardError: {
    borderColor: 'rgba(255, 93, 93, 0.28)',
  },
  mascot: {
    width: 84,
    height: 84,
  },
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
});