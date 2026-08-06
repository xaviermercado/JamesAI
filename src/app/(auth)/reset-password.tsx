import { Link, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AuthActionRow } from '@/components/auth/auth-action-row';
import { AuthCard, authPrimaryButtonStyle, authPrimaryTextStyle } from '@/components/auth/auth-card';
import { AuthFormField } from '@/components/auth/auth-form-field';
import { ThemedText } from '@/components/themed-text';
import { toSafeAuthActionMessage } from '@/features/auth/error-messages';
import { resetPasswordSchema } from '@/features/auth/validation';
import { resetAuthPassword } from '@/services/auth-api';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = useMemo(() => (typeof params.token === 'string' ? params.token.trim() : ''), [params.token]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const submit = async () => {
    if (busy) return;
    setErrors({});
    setMessage(null);

    if (!token) {
      setStatus('error');
      setMessage('This reset link is invalid or incomplete. Request a new one to continue.');
      return;
    }

    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        password: fieldErrors.password?.[0] ?? '',
        confirmPassword: fieldErrors.confirmPassword?.[0] ?? '',
      });
      return;
    }

    setBusy(true);
    try {
      await resetAuthPassword(token, parsed.data.password);
      setStatus('success');
      setMessage('Your password has been reset. You can log in with the new password now.');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setStatus('error');
      setMessage(toSafeAuthActionMessage(error, 'Unable to reset your password right now.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Choose a new password" description="Create a new password for your Scouty.ca account.">
      {!token ? (
        <ThemedText style={{ color: '#b42318' }}>This reset link is invalid or incomplete. Request a new one to continue.</ThemedText>
      ) : null}
      {status !== 'success' ? (
        <View style={{ gap: 16 }}>
          <AuthFormField
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            autoComplete="new-password"
            autoFocus
            hint="At least 12 characters"
            error={errors.password}
          />
          <AuthFormField
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            autoComplete="new-password"
            error={errors.confirmPassword}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset password"
            style={[authPrimaryButtonStyle, (busy || !token) && { opacity: 0.65 }]}
            onPress={() => void submit()}
            disabled={busy || !token}
          >
            {busy
              ? <ActivityIndicator size="small" color="#ffffff" />
              : <ThemedText style={authPrimaryTextStyle}>Reset password</ThemedText>}
          </Pressable>
        </View>
      ) : null}
      {message ? (
        <ThemedText
          style={status === 'error' ? { color: '#b42318', fontSize: 14 } : undefined}
          themeColor={status === 'success' ? 'textSecondary' : undefined}
          accessibilityLiveRegion="polite"
        >
          {message}
        </ThemedText>
      ) : null}
      <AuthActionRow>
        {status === 'success' ? (
          <Link href="/login" asChild>
            <Pressable accessibilityRole="link"><ThemedText type="linkPrimary">Log in</ThemedText></Pressable>
          </Link>
        ) : (
          <Link href="/forgot-password" asChild>
            <Pressable accessibilityRole="link"><ThemedText type="linkPrimary">Request a new reset email</ThemedText></Pressable>
          </Link>
        )}
      </AuthActionRow>
    </AuthCard>
  );
}
