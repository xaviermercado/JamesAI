import type { ComponentProps } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

interface AuthFormFieldProps extends ComponentProps<typeof TextInput> {
  label: string;
  error?: string | null;
}

export function AuthFormField({ label, error, style, ...props }: AuthFormFieldProps) {
  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput accessibilityLabel={label} style={[styles.input, style]} placeholderTextColor="#8a8f98" {...props} />
      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
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
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  errorText: {
    color: '#b42318',
  },
});