import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

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
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

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
      <Image
        source={backgroundForPeriod(presentation)}
        style={styles.heroBackground}
        contentFit="cover"
        accessibilityLabel=""
        accessible={false}
      />
      <View style={[styles.heroOverlay, { backgroundColor: presentation.overlayColor }]} />

      <View style={[styles.heroInner, isMobile ? styles.heroInnerMobile : styles.heroInnerDesktop]}>
        <View style={isMobile ? styles.contentColumnMobile : styles.contentColumnDesktop}>
          <ThemedText
            type="title"
            style={[styles.titleBase, isMobile ? styles.titleMobile : styles.titleDesktop]}
          >
            {presentation.heading}
          </ThemedText>

          <ThemedText style={isMobile ? styles.subtitleMobile : styles.subtitleDesktop}>
            Tell Scouty your mood, occasion, or oddly specific craving.
          </ThemedText>

          <TextInput
            accessibilityLabel="What do you wanna watch?"
            multiline
            numberOfLines={isMobile ? 3 : 4}
            value={props.description}
            onChangeText={props.onDescriptionChange}
            placeholder={
              isMobile
                ? "Tell Scouty what you're in the mood for\u2026"
                : "I'm in the mood for something\u2026"
            }
            placeholderTextColor="#6d86c7"
            style={[styles.promptInputBase, isMobile ? styles.promptInputMobile : styles.promptInputDesktop]}
          />

          <View style={[styles.actionRow, isMobile && styles.actionRowMobile]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open filters"
              style={({ hovered, pressed }) => [
                styles.filterButtonBase,
                isMobile ? styles.filterButtonMobile : styles.filterButtonDesktop,
                hovered && styles.secondaryHover,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setShowFilters((c) => !c)}
            >
              <ThemedText style={isMobile ? styles.buttonTextMobile : styles.filterButtonTextDesktop}>
                {activeFilterCount ? `Filters (${activeFilterCount})` : 'Filters'}
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Find something to watch"
              style={({ hovered, pressed }) => [
                styles.primaryButtonBase,
                isMobile ? styles.primaryButtonMobile : styles.primaryButtonDesktop,
                hovered && styles.primaryHover,
                pressed && styles.buttonPressed,
                props.isLoading && styles.buttonDisabled,
              ]}
              onPress={props.onSubmit}
              disabled={props.isLoading}
            >
              <ThemedText style={isMobile ? styles.primaryButtonTextMobile : styles.primaryButtonTextDesktop}>
                {props.isLoading ? 'Scouty is searching\u2026' : 'Find something to watch'}
              </ThemedText>
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

        <View
          pointerEvents="none"
          style={isMobile ? styles.mascotColumnMobile : styles.mascotColumnDesktop}
        >
          <Image
            source={scoutyHeroMascot}
            style={isMobile ? styles.mascotMobile : styles.mascotDesktop}
            contentFit="contain"
            accessibilityLabel=""
            accessible={false}
          />
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
    width: '100%',
  },
  heroBackground: {
    ...StyleSheet.absoluteFill,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
  },

  heroInner: {
    flexDirection: 'row',
    width: '100%',
    minWidth: 0,
  },
  heroInnerDesktop: {
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 40,
    gap: Spacing.four,
    minHeight: 520,
  },
  heroInnerMobile: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    padding: 20,
    paddingBottom: 0,
    gap: Spacing.three,
  },

  contentColumnDesktop: {
    flexShrink: 1,
    flexGrow: 1,
    flexBasis: 0,
    maxWidth: 760,
    gap: Spacing.three,
    zIndex: 1,
    minWidth: 0,
  },
  contentColumnMobile: {
    width: '100%',
    minWidth: 0,
    gap: Spacing.two,
    zIndex: 1,
  },

  titleBase: {
    color: BrandColors.surface,
  },
  titleDesktop: {
    fontSize: 72,
    lineHeight: 76,
    maxWidth: 620,
  },
  titleMobile: {
    fontSize: 36,
    lineHeight: 40,
  },

  subtitleDesktop: {
    color: BrandColors.surface,
    fontSize: 18,
    lineHeight: 30,
    maxWidth: 520,
  },
  subtitleMobile: {
    color: BrandColors.surface,
    fontSize: 15,
    lineHeight: 22,
  },

  promptInputBase: {
    borderRadius: Radii.large,
    backgroundColor: BrandColors.surface,
    color: BrandColors.ink,
    fontFamily: Fonts.sans,
    width: '100%',
    minWidth: 0,
  },
  promptInputDesktop: {
    minHeight: 92,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    fontSize: 18,
  },
  promptInputMobile: {
    minHeight: 120,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },

  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    minWidth: 0,
  },
  actionRowMobile: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    gap: 12,
  },

  filterButtonBase: {
    borderRadius: Radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
    backgroundColor: 'rgba(7, 21, 47, 0.16)',
    minHeight: 52,
  },
  filterButtonDesktop: {
    minWidth: 160,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  filterButtonMobile: {
    width: '100%',
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  filterButtonTextDesktop: {
    color: BrandColors.surface,
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 18,
  },
  buttonTextMobile: {
    color: BrandColors.surface,
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 17,
    textAlign: 'center',
  },

  primaryButtonBase: {
    borderRadius: Radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BrandColors.scoutyBlue,
    minHeight: 52,
  },
  primaryButtonDesktop: {
    minWidth: 280,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  primaryButtonMobile: {
    width: '100%',
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  primaryButtonTextDesktop: {
    color: BrandColors.surface,
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 20,
    textAlign: 'center',
  },
  primaryButtonTextMobile: {
    color: BrandColors.surface,
    fontFamily: Fonts.display,
    fontWeight: '700',
    fontSize: 17,
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.65,
  },

  mascotColumnDesktop: {
    flexShrink: 0,
    width: 380,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
  },
  mascotColumnMobile: {
    width: '100%',
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  mascotDesktop: {
    width: 380,
    height: 420,
  },
  mascotMobile: {
    width: '68%',
    maxWidth: 280,
    aspectRatio: 0.8,
  },

  primaryHover: {
    backgroundColor: '#2b6bf1',
  },
  primaryButtonPressed: {
    backgroundColor: '#1a5ad4',
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  secondaryHover: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  filterButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.20)',
    transform: [{ scale: 0.97 }],
    opacity: 0.88,
  },
  buttonPressed: {
    opacity: 0.92,
  },
});
