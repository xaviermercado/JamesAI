import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { resetAuthPassword } from '@/services/auth-api';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string; password?: string }>();
  const initialToken = useMemo(() => (typeof params.token === 'string' ? params.token : ''), [params.token]);
  const initialPassword = useMemo(() => (typeof params.password === 'string' ? params.password : ''), [params.password]);
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState(initialPassword);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const autoTried = useRef(false);

  const submit = async () => {
    if (!token.trim()) {
      setStatus('error');
      setMessage('Reset token is required.');
      return;
    }

    if (password.trim().length < 12) {
      setStatus('error');
      setMessage('Password must be at least 12 characters.');
      return;
    }

    setStatus('loading');
    setMessage(null);

    try {
      await resetAuthPassword(token.trim(), password);
      setStatus('success');
      setPassword('');
      setMessage('Password updated. You can now sign in with the new password.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to reset password.');
    }
  };

  useEffect(() => {
    if (autoTried.current) {
      return;
    }

    if (!initialToken.trim() || !initialPassword.trim()) {
      return;
    }

    autoTried.current = true;
    void submit();
  }, [initialPassword, initialToken]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          <ThemedText type="subtitle">Reset password</ThemedText>
          <ThemedText themeColor="textSecondary">
            Use the token from your reset email and choose a new password.
          </ThemedText>

          <TextInput
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Reset token"
            style={styles.input}
          />

          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="New password (12+ chars)"
            style={styles.input}
          />

          <Pressable style={styles.primaryButton} onPress={submit} disabled={status === 'loading'}>
            <ThemedText style={styles.primaryButtonText}>Set new password</ThemedText>
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
