import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AuthActionRow } from '@/components/auth/auth-action-row';
import { AuthCard } from '@/components/auth/auth-card';
import { ThemedText } from '@/components/themed-text';
import { toSafeAuthActionMessage } from '@/features/auth/error-messages';
import { resendVerificationEmail, verifyAuthEmailToken } from '@/services/auth-api';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const token = useMemo(() => (typeof params.token === 'string' ? params.token.trim() : ''), [params.token]);
  const email = useMemo(() => (typeof params.email === 'string' ? params.email.trim() : ''), [params.email]);
  const [status, setStatus] = useState<'pending' | 'verifying' | 'success' | 'error'>(token ? 'verifying' : 'pending');
  const [message, setMessage] = useState<string | null>(token ? 'Verifying your email address...' : (email ? 'Check your inbox for a verification link to finish setting up your account.' : null));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;

    void verifyAuthEmailToken(token)
      .then(() => {
        if (!active) {
          return;
        }
        setStatus('success');
        setMessage('Your email has been verified. You can log in now.');
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setStatus('error');
        setMessage(toSafeAuthActionMessage(error, 'Unable to verify your email right now.'));
      });

    return () => {
      active = false;
    };
  }, [token]);

  const resend = async () => {
    if (!email) {
      return;
    }

    setBusy(true);
    try {
      await resendVerificationEmail(email);
      setMessage('If the account exists and still needs verification, we sent another verification email.');
    } catch (error) {
      setMessage(toSafeAuthActionMessage(error, 'We could not resend the verification email right now.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Verify your email" description="Finish setting up your JamesAI account by confirming your email address.">
      <View style={{ gap: 16 }}>
        {status === 'verifying' || busy ? <ActivityIndicator size="small" color="#3c87f7" /> : null}
        {message ? <ThemedText themeColor={status === 'success' ? 'textSecondary' : undefined}>{message}</ThemedText> : null}
        {status !== 'success' && email ? (
          <Pressable accessibilityLabel="Resend verification email" style={{ borderRadius: 999, backgroundColor: '#e8edf6', paddingHorizontal: 24, paddingVertical: 12, alignSelf: 'flex-start' }} onPress={() => void resend()} disabled={busy}>
            <ThemedText style={{ color: '#334155', fontWeight: '700' }}>Resend verification email</ThemedText>
          </Pressable>
        ) : null}
      </View>
      <AuthActionRow>
        <Link href="/login" asChild>
          <Pressable><ThemedText type="linkPrimary">Log in</ThemedText></Pressable>
        </Link>
      </AuthActionRow>
    </AuthCard>
  );
}
