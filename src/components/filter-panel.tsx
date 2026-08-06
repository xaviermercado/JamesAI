import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BrandColors, Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

interface FilterPanelProps {
  mediaType: 'movie' | 'tv';
  maxRuntime: string;
  country: string;
  streamingServices: string;
  /** null = inherit saved languages; [] = explicit "any language"; [codes] = temporary override */
  languageOverride: string[] | null;
  hasSavedLanguages: boolean;
  onMediaTypeChange: (value: 'movie' | 'tv') => void;
  onMaxRuntimeChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onStreamingServicesChange: (value: string) => void;
  onLanguageOverrideChange: (value: string[] | null) => void;
  onClearAll: () => void;
}

export function FilterPanel(props: FilterPanelProps) {
  const anyLanguageSelected = Array.isArray(props.languageOverride) && props.languageOverride.length === 0;
  const hasLanguageText = Array.isArray(props.languageOverride) && props.languageOverride.length > 0;

  return (
    <View style={styles.panel} accessibilityLabel="Recommendation filters">
      <View style={styles.group}>
        <ThemedText type="smallBold">Media</ThemedText>
        <View style={styles.pillRow}>
          {(['movie', 'tv'] as const).map((option) => {
            const active = props.mediaType === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={`Select ${option}`}
                accessibilityState={{ selected: active }}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => props.onMediaTypeChange(option)}
              >
                <ThemedText style={[styles.pillText, active && styles.pillTextActive]}>
                  {option === 'movie' ? 'Movies' : 'TV'}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.groupHalf}>
          <ThemedText type="smallBold">Max runtime</ThemedText>
          <TextInput
            value={props.maxRuntime}
            onChangeText={props.onMaxRuntimeChange}
            keyboardType="numeric"
            placeholder="120"
            placeholderTextColor="#8a8f98"
            style={styles.input}
            accessibilityLabel="Maximum runtime in minutes"
          />
        </View>
        <View style={styles.groupHalf}>
          <ThemedText type="smallBold">Country</ThemedText>
          <TextInput
            value={props.country}
            onChangeText={props.onCountryChange}
            placeholder={props.hasSavedLanguages ? 'Saved region' : 'US'}
            placeholderTextColor="#8a8f98"
            style={styles.input}
            accessibilityLabel="Country or viewing region"
            autoCapitalize="characters"
            maxLength={2}
          />
        </View>
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold">Streaming services</ThemedText>
        <TextInput
          value={props.streamingServices}
          onChangeText={props.onStreamingServicesChange}
          placeholder="Netflix, Prime Video"
          placeholderTextColor="#8a8f98"
          style={styles.input}
          accessibilityLabel="Streaming services"
        />
        <ThemedText style={styles.hint}>Leave empty to use your saved services.</ThemedText>
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold">Content languages</ThemedText>
        <View style={styles.pillRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Any language"
            accessibilityState={{ selected: anyLanguageSelected }}
            style={[styles.pill, anyLanguageSelected && styles.pillActive]}
            onPress={() => props.onLanguageOverrideChange(anyLanguageSelected ? null : [])}
          >
            <ThemedText style={[styles.pillText, anyLanguageSelected && styles.pillTextActive]}>
              Any language
            </ThemedText>
          </Pressable>
        </View>
        {!anyLanguageSelected ? (
          <TextInput
            value={hasLanguageText ? props.languageOverride!.join(', ') : ''}
            onChangeText={(text) => {
              const codes = text.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
              props.onLanguageOverrideChange(codes.length > 0 ? codes : null);
            }}
            placeholder={props.hasSavedLanguages ? 'Saved languages' : 'en, fr, ja'}
            placeholderTextColor="#8a8f98"
            style={styles.input}
            accessibilityLabel="Language codes, comma separated"
            autoCapitalize="none"
          />
        ) : null}
        <ThemedText style={styles.hint}>
          Enter ISO codes (en, fr, ja) or leave empty to use your saved preferences.
        </ThemedText>
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
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  group: { gap: Spacing.two },
  groupHalf: { flex: 1, minWidth: 0, gap: Spacing.two },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  pill: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    backgroundColor: 'rgba(255,255,255,0.12)',
    minHeight: 36,
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: BrandColors.scoutyBlue },
  pillText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 14 },
  pillTextActive: { color: '#ffffff' },
  input: {
    borderRadius: Radii.small,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#ffffff',
    paddingHorizontal: Spacing.two,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 44,
  },
  hint: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  clearButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
    minHeight: 44,
    justifyContent: 'center',
  },
});
