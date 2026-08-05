import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BrandColors, Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

interface FilterPanelProps {
  mediaType: 'movie' | 'tv';
  maxRuntime: string;
  country: string;
  streamingServices: string;
  onMediaTypeChange: (value: 'movie' | 'tv') => void;
  onMaxRuntimeChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onStreamingServicesChange: (value: string) => void;
  onClearAll: () => void;
}

export function FilterPanel(props: FilterPanelProps) {
  return (
    <View style={styles.panel} accessibilityLabel="Recommendation filters">
      <View style={styles.group}>
        <ThemedText type="smallBold">Media</ThemedText>
        <View style={styles.pillRow}>
          {(['movie', 'tv'] as const).map((option) => {
            const active = props.mediaType === option;
            return (
              <Pressable key={option} accessibilityRole="button" accessibilityLabel={`Select ${option}`} style={[styles.pill, active && styles.pillActive]} onPress={() => props.onMediaTypeChange(option)}>
                <ThemedText style={[styles.pillText, active && styles.pillTextActive]}>{option === 'movie' ? 'Movies' : 'TV'}</ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.groupHalf}>
          <ThemedText type="smallBold">Max runtime</ThemedText>
          <TextInput value={props.maxRuntime} onChangeText={props.onMaxRuntimeChange} keyboardType="numeric" placeholder="120" placeholderTextColor="#8a8f98" style={styles.input} accessibilityLabel="Maximum runtime in minutes" />
        </View>
        <View style={styles.groupHalf}>
          <ThemedText type="smallBold">Country</ThemedText>
          <TextInput value={props.country} onChangeText={props.onCountryChange} placeholder="United States" placeholderTextColor="#8a8f98" style={styles.input} accessibilityLabel="Country" />
        </View>
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold">Streaming services</ThemedText>
        <TextInput value={props.streamingServices} onChangeText={props.onStreamingServicesChange} placeholder="Netflix, Prime Video" placeholderTextColor="#8a8f98" style={styles.input} accessibilityLabel="Streaming services" />
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Clear all filters" style={styles.clearButton} onPress={props.onClearAll}>
        <ThemedText type="linkPrimary">Clear all</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: Radii.large,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  group: {
    gap: Spacing.two,
  },
  groupHalf: {
    flex: 1,
    minWidth: 180,
    gap: Spacing.two,
  },
  input: {
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    color: BrandColors.surface,
    minHeight: 48,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  pill: {
    minHeight: 44,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  pillActive: {
    backgroundColor: BrandColors.scoutyCyan,
    borderColor: BrandColors.scoutyCyan,
  },
  pillText: {
    color: BrandColors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  pillTextActive: {
    color: BrandColors.midnight900,
  },
  clearButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
});