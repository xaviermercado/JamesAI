import { Pressable, StyleSheet, View } from 'react-native';

import { BrandColors, Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

type FeedbackAction = 'like' | 'dislike' | 'watched';

interface FeedbackActionsProps {
  selectedAction?: string;
  onAction: (action: FeedbackAction) => void;
}

const actions: { value: FeedbackAction; label: string; icon: string }[] = [
  { value: 'like', label: 'Like', icon: '♡' },
  { value: 'dislike', label: 'Not for me', icon: '⊘' },
  { value: 'watched', label: 'Watched', icon: '✓' },
];

export function FeedbackActions({ selectedAction, onAction }: FeedbackActionsProps) {
  return (
    <View style={styles.row}>
      {actions.map((action) => {
        const active = selectedAction === action.value;
        return (
          <Pressable
            key={action.value}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ hovered, pressed }) => [
              styles.button,
              active && styles.buttonActive,
              hovered && !active && styles.buttonHover,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => onAction(action.value)}>
            <ThemedText style={[styles.buttonText, active && styles.buttonTextActive]}>{`${action.icon} ${action.label}`}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  button: {
    minHeight: 44,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: BrandColors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    backgroundColor: BrandColors.surface,
  },
  buttonActive: {
    backgroundColor: '#edf4ff',
    borderColor: BrandColors.scoutyBlue,
  },
  buttonHover: {
    backgroundColor: '#f5f8ff',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonText: {
    color: BrandColors.midnight800,
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextActive: {
    color: BrandColors.scoutyBlue,
  },
});