import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BrandColors, Fonts, Radii, Spacing } from '@/constants/theme';

export function AdminSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText type="smallBold" accessibilityRole="header" style={styles.sectionTitle}>{title}</ThemedText>
        {description ? <ThemedText themeColor="textSecondary">{description}</ThemedText> : null}
      </View>
      {children}
    </View>
  );
}

export function AdminField({ label, error, hint, style, ...props }: ComponentProps<typeof TextInput> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        {...props}
        accessibilityLabel={label}
        accessibilityHint={error || hint}
        style={[styles.input, props.multiline && styles.multiline, error && styles.inputError, style]}
        placeholderTextColor="#667085"
      />
      {error ? <ThemedText accessibilityLiveRegion="polite" style={styles.error}>{error}</ThemedText> : null}
      {!error && hint ? <ThemedText style={styles.hint}>{hint}</ThemedText> : null}
    </View>
  );
}

export function AdminButton({ label, tone = 'primary', disabled, ...props }: Omit<ComponentProps<typeof Pressable>, 'children'> & {
  label: string;
  tone?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={[styles.button, styles[`${tone}Button`], disabled && styles.disabled]}
    >
      <ThemedText style={[styles.buttonText, tone !== 'primary' && styles.secondaryButtonText]}>{label}</ThemedText>
    </Pressable>
  );
}

export function ChoiceGroup<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.choices}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[styles.choice, selected && styles.choiceSelected]}
            >
              <ThemedText style={[styles.choiceText, selected && styles.choiceTextSelected]}>{option.label}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MultiChoiceGroup<T extends string | number>({ label, values, options, onChange }: {
  label: string;
  values: readonly T[];
  options: readonly { value: T; label: string }[];
  onChange: (values: T[]) => void;
}) {
  return (
    <View accessibilityLabel={label} style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.choices}>
        {options.map((option) => {
          const selected = values.includes(option.value);
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(selected ? values.filter((value) => value !== option.value) : [...values, option.value])}
              style={[styles.choice, selected && styles.choiceSelected]}
            >
              <ThemedText style={[styles.choiceText, selected && styles.choiceTextSelected]}>{option.label}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function StatusMessage({ message, tone = 'neutral' }: { message: string | null; tone?: 'neutral' | 'error' | 'success' }) {
  if (!message) return null;
  return (
    <View style={[styles.status, tone === 'error' && styles.statusError, tone === 'success' && styles.statusSuccess]}>
      <ThemedText accessibilityLiveRegion="polite" style={tone === 'error' ? styles.error : undefined}>{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%', borderTopWidth: 1, borderTopColor: BrandColors.border, paddingTop: Spacing.four, gap: Spacing.three },
  sectionHeader: { gap: Spacing.one, maxWidth: 760 },
  sectionTitle: { fontFamily: Fonts.display, fontSize: 20, lineHeight: 28 },
  field: { flex: 1, minWidth: 220, gap: Spacing.one },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#cbd2dc', borderRadius: Radii.small, backgroundColor: BrandColors.surface, paddingHorizontal: Spacing.three, paddingVertical: 12, fontSize: 16, color: BrandColors.ink },
  multiline: { minHeight: 104, textAlignVertical: 'top' },
  inputError: { borderColor: '#b42318' },
  error: { color: '#b42318', fontSize: 13, lineHeight: 18 },
  hint: { color: BrandColors.muted, fontSize: 13, lineHeight: 18 },
  button: { minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: Radii.small, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { backgroundColor: BrandColors.scoutyBlue },
  secondaryButton: { backgroundColor: '#e8eef8', borderWidth: 1, borderColor: BrandColors.border },
  dangerButton: { backgroundColor: '#fff1f0', borderWidth: 1, borderColor: '#f4b4ae' },
  buttonText: { color: BrandColors.surface, fontFamily: Fonts.display, fontWeight: 800 },
  secondaryButtonText: { color: BrandColors.midnight900 },
  disabled: { opacity: 0.45 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choice: { minHeight: 44, minWidth: 44, paddingHorizontal: Spacing.three, borderRadius: Radii.small, borderWidth: 1, borderColor: '#cbd2dc', backgroundColor: BrandColors.surface, alignItems: 'center', justifyContent: 'center' },
  choiceSelected: { borderColor: BrandColors.scoutyBlue, backgroundColor: '#e8f0ff' },
  choiceText: { color: BrandColors.ink, fontSize: 14 },
  choiceTextSelected: { color: BrandColors.midnight800, fontWeight: 800 },
  status: { padding: Spacing.three, borderLeftWidth: 4, borderLeftColor: BrandColors.scoutyBlue, backgroundColor: '#eef4ff' },
  statusError: { borderLeftColor: '#b42318', backgroundColor: '#fff1f0' },
  statusSuccess: { borderLeftColor: '#147d52', backgroundColor: '#edf9f3' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
});

export const adminGridStyle = styles.grid;
export const adminRowStyle = styles.row;