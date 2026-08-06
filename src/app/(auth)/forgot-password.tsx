import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { AuthActionRow } from '@/components/auth/auth-action-row';
import { AuthCard, authPrimaryButtonStyle, authPrimaryTextStyle } from '@/components/auth/auth-card';
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
    if (busy) return;
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
      setNotice('If an account exists for that email address, we\u2019ll send password-reset instructions.');
    } catch (nextError) {
      setError(toSafeAuthActionMessage(nextError, 'We could not send reset instructions right now.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Reset your password" description="Enter your email and we\u2019ll send reset instructions if an account exists.">
      <AuthFormField
        label="Email address"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        autoFocus
        error={fieldError}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send reset link"
        style={[authPrimaryButtonStyle, busy && { opacity: 0.65 }]}
        onPress={() => void submit()}
        disabled={busy}
      >
        {busy
          ? <ActivityIndicator size="small" color="#ffffff" />
          : <ThemedText style={authPrimaryTextStyle}>Send reset link</ThemedText>}
      </Pressable>
      {notice ? <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">{notice}</ThemedText> : null}
      {error ? <ThemedText style={{ color: '#b42318', fontSize: 14 }} accessibilityLiveRegion="polite">{error}</ThemedText> : null}
      <AuthActionRow>
        <Link href="/login" asChild>
          <Pressable accessibilityRole="link"><ThemedText type="linkPrimary">Back to login</ThemedText></Pressable>
        </Link>
      </AuthActionRow>
    </AuthCard>
  );
}
