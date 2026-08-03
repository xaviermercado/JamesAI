import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { verifyAuthEmailToken } from '@/services/auth-api';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const initialToken = useMemo(() => (typeof params.token === 'string' ? params.token : ''), [params.token]);
  const [token, setToken] = useState(initialToken);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const autoTried = useRef(false);

  const submit = async () => {
    if (!token.trim()) {
      setStatus('error');
      setMessage('Verification token is required.');
      return;
    }

    setStatus('loading');
    setMessage(null);

    try {
      await verifyAuthEmailToken(token.trim());
      setStatus('success');
      setMessage('Email verified. You can now sign in.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to verify email.');
    }
  };

  useEffect(() => {
    if (autoTried.current) {
      return;
    }

    if (!initialToken.trim()) {
      return;
    }

    autoTried.current = true;
    void submit();
  }, [initialToken]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          <ThemedText type="subtitle">Verify email</ThemedText>
          <ThemedText themeColor="textSecondary">
            Paste the token from your email link, or open the link directly to prefill it.
          </ThemedText>

          <TextInput
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Verification token"
            style={styles.input}
          />

          <Pressable style={styles.primaryButton} onPress={submit} disabled={status === 'loading'}>
            <ThemedText style={styles.primaryButtonText}>Verify account</ThemedText>
          </Pressable>

          {status === 'loading' ? <ActivityIndicator /> : null}
          {message ? <ThemedText themeColor={status === 'error' ? undefined : 'textSecondary'}>{message}</ThemedText> : null}

          <Link href="/explore" asChild>
            <Pressable style={styles.linkButton}>
              <ThemedText type="linkPrimary">Back to account panel</ThemedText>
            </Pressable>
          </Link>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    padding: Spacing.four,
  },
  card: {
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    backgroundColor: '#f0f0f3',
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
  primaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    backgroundColor: '#3c87f7',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  linkButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
});
