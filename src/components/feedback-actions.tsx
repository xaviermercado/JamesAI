import { Pressable, StyleSheet, View } from 'react-native';

import { BrandColors, Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

type FeedbackAction = 'like' | 'dislike' | 'watched';

interface FeedbackActionsProps {
  selectedAction?: FeedbackAction;
  onAction: (action: FeedbackAction) => void;
  onRemove?: () => void;
  disabled?: boolean;
  submitting?: boolean;
  errorMessage?: string | null;
}

const actions: { value: FeedbackAction; label: string; icon: string }[] = [
  { value: 'like', label: 'Like', icon: '♡' },
  { value: 'dislike', label: 'Not for me', icon: '⊘' },
  { value: 'watched', label: 'Watched', icon: '✓' },
];

export function FeedbackActions({
  selectedAction,
  onAction,
  onRemove,
  disabled,
  submitting,
  errorMessage,
}: FeedbackActionsProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {actions.map((action) => {
          const active = selectedAction === action.value;
          return (
            <Pressable
              key={action.value}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityState={{ selected: active, disabled: Boolean(disabled || submitting) }}
              style={({ hovered, pressed }) => [
                styles.button,
                active && styles.buttonActive,
                hovered && !active && styles.buttonHover,
                pressed && styles.buttonPressed,
                (disabled || submitting) && styles.buttonDisabled,
              ]}
              onPress={() => onAction(action.value)}
              disabled={disabled || submitting}
            >
              <ThemedText style={[styles.buttonText, active && styles.buttonTextActive]}>
                {`${action.icon} ${action.label}${active ? ' (selected)' : ''}`}
              </ThemedText>
            </Pressable>
          );
        })}

        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove feedback"
            accessibilityState={{ disabled: Boolean(disabled || submitting) }}
            style={({ hovered, pressed }) => [
              styles.button,
              styles.removeButton,
              hovered && styles.buttonHover,
              pressed && styles.buttonPressed,
              (disabled || submitting) && styles.buttonDisabled,
            ]}
            onPress={onRemove}
            disabled={disabled || submitting}
          >
            <ThemedText style={styles.removeButtonText}>Remove feedback</ThemedText>
          </Pressable>
        ) : null}
      </View>

      {submitting ? (
        <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite" style={styles.statusText}>
          Saving feedback...
        </ThemedText>
      ) : null}
      {errorMessage ? (
        <ThemedText accessibilityLiveRegion="polite" style={styles.errorText}>
          {errorMessage}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.one,
  },
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
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: BrandColors.midnight800,
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextActive: {
    color: BrandColors.scoutyBlue,
  },
  removeButton: {
    backgroundColor: '#fff5f5',
    borderColor: '#f3c1bf',
  },
  removeButtonText: {
    color: '#b42318',
    fontSize: 14,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 13,
  },
  errorText: {
    fontSize: 13,
    color: '#b42318',
  },
});