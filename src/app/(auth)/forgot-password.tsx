import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { AuthActionRow } from '@/components/auth/auth-action-row';
import { AuthCard } from '@/components/auth/auth-card';
import { AuthFormField } from '@/components/auth/auth-form-field';
import { ThemedText } from '@/components/themed-text';
import { toSafeAuthActionMessage } from '@/features/auth/error-messages';
import { forgotPasswordSchema } from '@/features/auth/validation';
import { requestPasswordReset } from '@/services/auth-api';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setFieldError(null);
    setError(null);
    setNotice(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.flatten().fieldErrors.email?.[0] ?? 'Enter a valid email address');
      return;
    }

    setBusy(true);
    try {
      await requestPasswordReset(parsed.data.email);
      setNotice('If an account exists for that email address, we’ll send password-reset instructions.');
    } catch (nextError) {
      setError(toSafeAuthActionMessage(nextError, 'We could not send reset instructions right now.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Reset your password" description="Enter your email and we’ll send reset instructions if an account exists.">
      <AuthFormField label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoFocus error={fieldError} />
      <Pressable accessibilityLabel="Send reset link" style={{ borderRadius: 999, backgroundColor: '#3c87f7', paddingHorizontal: 24, paddingVertical: 12, alignSelf: 'flex-start' }} onPress={() => void submit()} disabled={busy}>
        <ThemedText style={{ color: '#ffffff', fontWeight: '700' }}>Send reset link</ThemedText>
      </Pressable>
      {busy ? <ActivityIndicator size="small" color="#3c87f7" /> : null}
      {notice ? <ThemedText themeColor="textSecondary">{notice}</ThemedText> : null}
      {error ? <ThemedText>{error}</ThemedText> : null}
      <AuthActionRow>
        <Link href="/login" asChild>
          <Pressable><ThemedText type="linkPrimary">Back to login</ThemedText></Pressable>
        </Link>
      </AuthActionRow>
    </AuthCard>
  );
}
