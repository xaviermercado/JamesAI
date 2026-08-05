import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { scoutyHeroMascot } from '@/constants/brand';
import { BrandColors, Fonts, Radii, Spacing } from '@/constants/theme';
import { getHeroPresentationData, type HeroPresentationData } from '@/features/hero/hero-period';
import { FilterPanel } from '@/components/filter-panel';
import { ThemedText } from '@/components/themed-text';
import type { MediaType } from '@/types/recommendations';

const DAY_BACKGROUND = require('../../scouty-copilot-handoff/assets/scouty-hero-background-day.png') as number;
const NIGHT_BACKGROUND = require('../../scouty-copilot-handoff/assets/scouty-hero-background.png') as number;

function backgroundForPeriod(data: HeroPresentationData): number {
  return data.period === 'day' ? DAY_BACKGROUND : NIGHT_BACKGROUND;
}

interface HeroRecommendationFormProps {
  description: string;
  mediaType: MediaType;
  maxRuntime: string;
  country: string;
  streamingServices: string;
  onDescriptionChange: (value: string) => void;
  onMediaTypeChange: (value: MediaType) => void;
  onMaxRuntimeChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onStreamingServicesChange: (value: string) => void;
  onSubmit: () => void;
  onClearFilters: () => void;
  isLoading: boolean;
}

export function HeroRecommendationForm(props: HeroRecommendationFormProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [presentation, setPresentation] = useState<HeroPresentationData>(
    () => getHeroPresentationData(new Date()),
  );

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const refresh = () => {
      if (document.visibilityState === 'visible') {
        setPresentation(getHeroPresentationData(new Date()));
      }
    };

    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  const activeFilterCount = useMemo(() => {
    return [
      props.mediaType !== 'movie',
      Boolean(props.maxRuntime.trim()),
      Boolean(props.country.trim()),
      Boolean(props.streamingServices.trim()),
    ].filter(Boolean).length;
  }, [props.country, props.maxRuntime, props.mediaType, props.streamingServices]);

  return (
    <View style={styles.heroOuter}>
      <Image source={backgroundForPeriod(presentation)} style={styles.heroBackground} contentFit="cover" accessibilityLabel="" accessible={false} />
      <View style={[styles.heroOverlay, { backgroundColor: presentation.overlayColor }]} />
      <View style={styles.heroInner}>
        <View style={styles.contentColumn}>
          <ThemedText type="title" style={styles.title}>{presentation.heading}</ThemedText>
          <ThemedText style={styles.subtitle}>Tell Scouty your mood, occasion, or oddly specific craving.</ThemedText>
          <TextInput
            accessibilityLabel="What do you wanna watch?"
            multiline
            numberOfLines={4}
            value={props.description}
            onChangeText={props.onDescriptionChange}
            placeholder="I’m in the mood for something…"
            placeholderTextColor="#6d86c7"
            style={styles.promptInput}
          />
          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Open filters" style={({ hovered, pressed }) => [styles.filterButton, hovered && styles.secondaryHover, pressed && styles.buttonPressed]} onPress={() => setShowFilters((current) => !current)}>
              <ThemedText style={styles.filterButtonText}>{activeFilterCount ? `Filters (${activeFilterCount})` : 'Filters'}</ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Find something to watch" style={({ hovered, pressed }) => [styles.primaryButton, hovered && styles.primaryHover, pressed && styles.buttonPressed]} onPress={props.onSubmit} disabled={props.isLoading}>
              <ThemedText style={styles.primaryButtonText}>{props.isLoading ? 'Scouty is searching…' : 'Find something to watch'}</ThemedText>
            </Pressable>
          </View>
          {showFilters ? (
            <FilterPanel
              mediaType={props.mediaType}
              maxRuntime={props.maxRuntime}
              country={props.country}
              streamingServices={props.streamingServices}
              onMediaTypeChange={props.onMediaTypeChange}
              onMaxRuntimeChange={props.onMaxRuntimeChange}
              onCountryChange={props.onCountryChange}
              onStreamingServicesChange={props.onStreamingServicesChange}
              onClearAll={() => {
                props.onClearFilters();
                setShowFilters(false);
              }}
            />
          ) : null}
        </View>
        <View pointerEvents="none" style={styles.mascotColumn}>
          <Image source={scoutyHeroMascot} style={styles.mascot} contentFit="contain" accessibilityLabel="" accessible={false} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroOuter: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: Radii.hero,
    backgroundColor: BrandColors.midnight900,
    minHeight: 520,
  },
  heroBackground: {
    ...StyleSheet.absoluteFill,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
  },
  heroInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.four,
    padding: 40,
  },
  contentColumn: {
    flexGrow: 1,
    flexBasis: 520,
    maxWidth: 760,
    gap: Spacing.three,
    zIndex: 1,
  },
  mascotColumn: {
    flexBasis: 380,
    flexGrow: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    minHeight: 320,
  },
  mascot: {
    width: '100%',
    maxWidth: 420,
    minHeight: 320,
  },
  title: {
    color: BrandColors.surface,
    fontSize: 72,
    lineHeight: 76,
    maxWidth: 620,
  },
  subtitle: {
    color: BrandColors.surface,
    fontSize: 18,
    lineHeight: 30,
    maxWidth: 520,
  },
  promptInput: {
    minHeight: 92,
    borderRadius: Radii.large,
    backgroundColor: BrandColors.surface,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    color: BrandColors.ink,
    fontSize: 18,
    fontFamily: Fonts.sans,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filterButton: {
    minHeight: 56,
    minWidth: 170,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
    backgroundColor: 'rgba(7, 21, 47, 0.16)',
  },
  filterButtonText: {
    color: BrandColors.surface,
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 18,
  },
  primaryButton: {
    minHeight: 56,
    minWidth: 300,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    justifyContent: 'center',
    backgroundColor: BrandColors.scoutyBlue,
  },
  primaryButtonText: {
    color: BrandColors.surface,
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 20,
    textAlign: 'center',
  },
  primaryHover: {
    backgroundColor: '#2b6bf1',
  },
  secondaryHover: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  buttonPressed: {
    opacity: 0.92,
  },
});