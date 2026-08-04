import { Link, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AuthActionRow } from '@/components/auth/auth-action-row';
import { AuthCard } from '@/components/auth/auth-card';
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
    setErrors({});
    setMessage(null);
    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!token) {
      setStatus('error');
      setMessage('This reset link is invalid or incomplete. Request a new one to continue.');
      return;
    }

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
    <AuthCard title="Choose a new password" description="Create a new password for your JamesAI account.">
      {!token ? <ThemedText>This reset link is invalid or incomplete. Request a new one to continue.</ThemedText> : null}
      {status !== 'success' ? (
        <View style={{ gap: 16 }}>
          <AuthFormField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoFocus error={errors.password} />
          <AuthFormField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" error={errors.confirmPassword} />
          <Pressable accessibilityLabel="Reset password" style={{ borderRadius: 999, backgroundColor: '#3c87f7', paddingHorizontal: 24, paddingVertical: 12, alignSelf: 'flex-start' }} onPress={() => void submit()} disabled={busy || !token}>
            <ThemedText style={{ color: '#ffffff', fontWeight: '700' }}>Reset password</ThemedText>
          </Pressable>
        </View>
      ) : null}
      {busy ? <ActivityIndicator size="small" color="#3c87f7" /> : null}
      {message ? <ThemedText themeColor={status === 'success' ? 'textSecondary' : undefined}>{message}</ThemedText> : null}
      <AuthActionRow>
        {status === 'success' ? (
          <Link href="/login" asChild>
            <Pressable><ThemedText type="linkPrimary">Log in</ThemedText></Pressable>
          </Link>
        ) : (
          <Link href="/forgot-password" asChild>
            <Pressable><ThemedText type="linkPrimary">Request a new reset email</ThemedText></Pressable>
          </Link>
        )}
      </AuthActionRow>
    </AuthCard>
  );
}
