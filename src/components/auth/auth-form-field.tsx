import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BrandColors, Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

interface AuthFormFieldProps extends ComponentProps<typeof TextInput> {
  label: string;
  error?: string | null;
  hint?: string;
  rightAccessory?: ReactNode;
}

export function AuthFormField({ label, error, hint, style, rightAccessory, ...props }: AuthFormFieldProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {hint && !error ? <ThemedText style={styles.hintText}>{hint}</ThemedText> : null}
      <View style={styles.inputWrap}>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          style={[
            styles.input,
            focused && styles.inputFocused,
            hasError && styles.inputError,
            rightAccessory ? styles.inputWithAccessory : null,
            style,
          ]}
          placeholderTextColor="#8a8f98"
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          {...props}
        />
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </View>
      {error ? <ThemedText style={styles.errorText} accessibilityRole="text" accessibilityLiveRegion="polite">{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
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
  inputWithAccessory: {
    paddingRight: 52,
  },
  accessory: {
    position: 'absolute',
    right: Spacing.two,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
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