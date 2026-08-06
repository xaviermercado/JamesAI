import type { ComponentProps } from 'react';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BrandColors, Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

interface AuthFormFieldProps extends ComponentProps<typeof TextInput> {
  label: string;
  error?: string | null;
  hint?: string;
}

export function AuthFormField({ label, error, hint, style, ...props }: AuthFormFieldProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {hint && !error ? <ThemedText style={styles.hintText}>{hint}</ThemedText> : null}
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        style={[
          styles.input,
          focused && styles.inputFocused,
          hasError && styles.inputError,
          style,
        ]}
        placeholderTextColor="#8a8f98"
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        {...props}
      />
      {error ? <ThemedText style={styles.errorText} accessibilityRole="text" accessibilityLiveRegion="polite">{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d7dce3',
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#ffffff',
    minHeight: 52,
  },
  inputFocused: {
    borderColor: BrandColors.scoutyBlue,
    boxShadow: '0 0 0 3px rgba(52, 120, 246, 0.18)',
  },
  inputError: {
    borderColor: '#b42318',
  },
  errorText: {
    color: '#b42318',
    fontSize: 13,
    lineHeight: 18,
  },
  hintText: {
    color: '#667085',
    fontSize: 13,
    lineHeight: 18,
  },
});