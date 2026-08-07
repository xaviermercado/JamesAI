import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Dimensions, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { scoutyHeroMascot } from '@/constants/brand';
import { BrandColors, Fonts, Radii, Spacing } from '@/constants/theme';
import { getHeroPresentationData, type HeroPresentationData } from '@/features/hero/hero-period';
import { getMobileHeroTitleMetrics, isHeroMobileLayout } from '@/features/hero/hero-layout';
import { FilterPanel } from '@/components/filter-panel';
import { ThemedText } from '@/components/themed-text';
import type { MediaType } from '@/types/recommendations';

const DAY_BACKGROUND = require('../../scouty-copilot-handoff/assets/scouty-hero-background-day.png') as number;
const NIGHT_BACKGROUND = require('../../scouty-copilot-handoff/assets/scouty-hero-background.png') as number;

function backgroundForPeriod(data: HeroPresentationData): number {
  return data.period === 'day' ? DAY_BACKGROUND : NIGHT_BACKGROUND;
}

function readViewportWidth(): number {
  if (typeof window !== 'undefined' && typeof window.innerWidth === 'number') {
    return window.innerWidth;
  }

  return Dimensions.get('window').width;
}

interface HeroRecommendationFormProps {
  description: string;
  mediaType: MediaType;
  maxRuntime: string;
  country: string;
  streamingServices: string;
  languageOverride: string[] | null;
  savedPrefSummary: string | null;
  hasSavedLanguages: boolean;
  onDescriptionChange: (value: string) => void;
  onMediaTypeChange: (value: MediaType) => void;
  onMaxRuntimeChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onStreamingServicesChange: (value: string) => void;
  onLanguageOverrideChange: (value: string[] | null) => void;
  onSubmit: () => void;
  onClearFilters: () => void;
  isLoading: boolean;
}

export function HeroRecommendationForm(props: HeroRecommendationFormProps) {
  const viewportWidth = readViewportWidth();

  const isMobile = isHeroMobileLayout(viewportWidth);
  const mobileTitle = getMobileHeroTitleMetrics(viewportWidth);

  const [showFilters, setShowFilters] = useState(false);
  const [presentation, setPresentation] = useState<HeroPresentationData>(
    () => getHeroPresentationData(new Date()),
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;

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
      props.languageOverride !== null,
    ].filter(Boolean).length;
  }, [props.country, props.maxRuntime, props.mediaType, props.streamingServices, props.languageOverride]);

  return (
    <View style={styles.heroOuter}>
      <Image source={backgroundForPeriod(presentation)} style={styles.heroBackground} contentFit="cover" accessibilityLabel="" accessible={false} />
      <View style={[styles.heroOverlay, { backgroundColor: presentation.overlayColor }]} />

      <View style={[styles.heroInner, isMobile ? styles.heroInnerMobile : styles.heroInnerDesktop]}>
        <View style={isMobile ? styles.contentColumnMobile : styles.contentColumnDesktop}>
          <ThemedText
            type="title"
            style={[
              styles.title,
              isMobile
                ? {
                  fontSize: mobileTitle.fontSize,
                  lineHeight: mobileTitle.lineHeight,
                  maxWidth: '100%',
                }
                : null,
            ]}
          >
            What should we watch tonight?
          </ThemedText>

          <ThemedText style={[styles.subtitle, isMobile ? styles.subtitleMobile : null]}>
            Tell Scouty your mood, occasion, or oddly specific craving.
          </ThemedText>

          {props.savedPrefSummary ? (
            <View style={styles.prefBanner} accessibilityLiveRegion="polite">
              <ThemedText style={styles.prefBannerText}>{props.savedPrefSummary}</ThemedText>
              <ThemedText style={styles.prefBannerHint}>Filters below apply to this search only.</ThemedText>
            </View>
          ) : null}

          <TextInput
            accessibilityLabel="What should we watch tonight?"
            multiline
            numberOfLines={4}
            value={props.description}
            onChangeText={props.onDescriptionChange}
            placeholder="I’m in the mood for something…"
            placeholderTextColor="#6d86c7"
            style={[styles.promptInput, isMobile ? styles.promptInputMobile : null]}
          />

          <View style={[styles.actionRow, isMobile ? styles.actionRowMobile : null]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Find something to watch"
              style={({ hovered, pressed }) => [
                styles.primaryButton,
                isMobile ? styles.mobileActionButton : null,
                hovered && styles.primaryHover,
                pressed && styles.buttonPressed,
                props.isLoading && styles.buttonDisabled,
              ]}
              onPress={props.onSubmit}
              disabled={props.isLoading}
            >
              <ThemedText style={styles.primaryButtonText}>{props.isLoading ? 'Scouty is searching…' : 'Find something to watch'}</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open filters"
              style={({ hovered, pressed }) => [
                styles.filterButton,
                isMobile ? styles.mobileActionButton : null,
                hovered && styles.secondaryHover,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setShowFilters((current) => !current)}
            >
              <ThemedText style={styles.filterButtonText}>{activeFilterCount ? `Filters (${activeFilterCount})` : 'Filters'}</ThemedText>
            </Pressable>
          </View>
        </View>

        <View pointerEvents="none" style={[styles.mascotColumn, isMobile ? styles.mascotColumnMobile : null]}>
          <Image
            source={scoutyHeroMascot}
            style={[styles.mascot, isMobile ? styles.mascotMobile : null]}
            contentFit="contain"
            accessibilityLabel=""
            accessible={false}
          />
        </View>

          {showFilters ? (
            <FilterPanel
              mediaType={props.mediaType}
              maxRuntime={props.maxRuntime}
              country={props.country}
              streamingServices={props.streamingServices}
              languageOverride={props.languageOverride}
              hasSavedLanguages={props.hasSavedLanguages}
              onMediaTypeChange={props.onMediaTypeChange}
              onMaxRuntimeChange={props.onMaxRuntimeChange}
              onCountryChange={props.onCountryChange}
              onStreamingServicesChange={props.onStreamingServicesChange}
              onLanguageOverrideChange={props.onLanguageOverrideChange}
              onClearAll={() => { props.onClearFilters(); setShowFilters(false); }}
            />
          ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroOuter: { position: 'relative', overflow: 'hidden', borderRadius: Radii.hero, backgroundColor: BrandColors.midnight900, width: '100%' },
  heroBackground: { ...StyleSheet.absoluteFill },
  heroOverlay: { ...StyleSheet.absoluteFill },
  heroInner: { gap: Spacing.four, width: '100%' },
  heroInnerDesktop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', padding: 40 },
  heroInnerMobile: { flexDirection: 'column', flexWrap: 'nowrap', justifyContent: 'flex-start', paddingHorizontal: Spacing.three, paddingVertical: Spacing.four },
  contentColumnDesktop: { flexGrow: 1, flexShrink: 1, flexBasis: 520, maxWidth: 760, gap: Spacing.three, zIndex: 1, minWidth: 0 },
  contentColumnMobile: { width: '100%', maxWidth: '100%', gap: Spacing.three, zIndex: 1, minWidth: 0 },
  title: { color: BrandColors.surface, fontSize: 72, lineHeight: 76, maxWidth: 620, minWidth: 0 },
  subtitle: { color: BrandColors.surface, fontSize: 18, lineHeight: 30, maxWidth: 520, minWidth: 0 },
  subtitleMobile: { maxWidth: '100%', lineHeight: 28 },
  prefBanner: {
    backgroundColor: 'rgba(52,120,246,0.18)',
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 2,
  },
  prefBannerText: { color: '#dbeafe', fontSize: 13, fontWeight: '600' },
  prefBannerHint: { color: '#93c5fd', fontSize: 12 },
  promptInput: { minHeight: 92, borderRadius: Radii.large, backgroundColor: BrandColors.surface, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, color: BrandColors.ink, fontSize: 18, fontFamily: Fonts.sans, width: '100%', maxWidth: '100%', alignSelf: 'stretch' },
  promptInputMobile: { minHeight: 96 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, width: '100%', maxWidth: '100%', minWidth: 0 },
  actionRowMobile: { flexDirection: 'column', flexWrap: 'nowrap' },
  mobileActionButton: { width: '100%', minWidth: 0, alignSelf: 'stretch' },
  filterButton: { minHeight: 56, minWidth: 170, borderRadius: Radii.pill, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.48)', backgroundColor: 'rgba(7, 21, 47, 0.16)' },
  filterButtonText: { color: BrandColors.surface, fontFamily: Fonts.display, fontWeight: '700', fontSize: 18 },
  primaryButton: { minHeight: 56, minWidth: 300, borderRadius: Radii.pill, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, justifyContent: 'center', backgroundColor: BrandColors.scoutyBlue },
  primaryButtonText: { color: BrandColors.surface, fontFamily: Fonts.display, fontWeight: '700', fontSize: 20, textAlign: 'center' },
  buttonDisabled: { opacity: 0.65 },
  mascotColumn: { flexBasis: 360, flexGrow: 0, flexShrink: 0, alignItems: 'flex-end', justifyContent: 'flex-end', minHeight: 320, minWidth: 0 },
  mascotColumnMobile: { width: '100%', flexBasis: 'auto', flexGrow: 0, minHeight: 0, alignItems: 'center', justifyContent: 'center' },
  mascot: { width: '100%', maxWidth: 420, height: 320 },
  mascotMobile: { width: '82%', maxWidth: 300, height: 220 },
  primaryHover: { backgroundColor: '#2b6bf1' },
  secondaryHover: { backgroundColor: 'rgba(255,255,255,0.12)' },
  buttonPressed: { opacity: 0.92 },
});
