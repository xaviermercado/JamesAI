import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  loginAuthAccount,
  logoutAllAuthDevices,
  logoutAuthAccount,
  registerAuthAccount,
  requestPasswordReset,
  resendVerificationEmail,
} from '@/services/auth-api';

export default function AccountScreen() {
  const { status, user, csrfToken, refreshSession } = useAuthSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const withAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'Request failed';
      if (message.includes('already exists')) {
        setError(`${message} Use Sign in below, or tap Forgot password if needed.`);
      } else if (message.includes('Invalid email or password')) {
        setError('Email or password did not match. If you already registered, try Forgot password.');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const sessionTitle =
    status === 'loading'
      ? 'Checking your session...'
      : status === 'authenticated'
        ? `Signed in as ${user?.email ?? 'your account'}`
        : 'You are not signed in.';

  const sessionHint =
    status === 'loading'
      ? 'One moment while we confirm your account state.'
      : status === 'authenticated'
        ? 'Your account is active in this browser. You can edit your profile or sign out below.'
        : 'If you already registered, use Sign in. If not, create a new account with Register.';

  const register = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('Enter an email address.');
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }

    await withAction(async () => {
      await registerAuthAccount(normalizedEmail, password);
      setNotice('Account created. Check your email for a verification link, then return here and sign in.');
      await refreshSession();
    });
  };

  const login = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('Enter an email address.');
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }

    await withAction(async () => {
      await loginAuthAccount(normalizedEmail, password);
      setNotice('Signed in successfully.');
      await refreshSession();
    });
  };

  const logout = async () => {
    if (!csrfToken) {
      setError('No active session to sign out.');
      return;
    }

    await withAction(async () => {
      await logoutAuthAccount(csrfToken);
      await refreshSession();
      setNotice('Signed out.');
    });
  };

  const logoutAll = async () => {
    if (!csrfToken) {
      setError('No active session to revoke.');
      return;
    }

    await withAction(async () => {
      await logoutAllAuthDevices(csrfToken);
      await refreshSession();
      setNotice('Signed out from all devices.');
    });
  };

  const resendVerification = async () => {
    await withAction(async () => {
      await resendVerificationEmail(email);
      setNotice('If the account exists and is unverified, a verification email was sent.');
    });
  };

  const forgotPassword = async () => {
    await withAction(async () => {
      await requestPasswordReset(email);
      setNotice('If the account exists, a password reset email was sent.');
    });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.heroCard}>
            <ThemedText type="subtitle">Account center</ThemedText>
            <ThemedText themeColor="textSecondary">
              Optional account flows: register, sign in, verify email, and recover password.
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <ThemedText type="smallBold">Session</ThemedText>
            <ThemedText>{sessionTitle}</ThemedText>
            <ThemedText themeColor="textSecondary">{sessionHint}</ThemedText>
            <ThemedText>
              Status: {status}
            </ThemedText>
            <ThemedText>
              Account: {user?.accountStatus ?? 'none'}
            </ThemedText>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                void withAction(async () => {
                  await refreshSession();
                  setNotice('Session refreshed.');
                });
              }}
              disabled={busy}>
              <ThemedText style={styles.secondaryButtonText}>Refresh session status</ThemedText>
            </Pressable>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <ThemedText type="smallBold">Sign up or sign in</ThemedText>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="Email"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Password (12+ chars)"
              style={styles.input}
            />
            <View style={styles.buttonRow}>
              <Pressable style={styles.primaryButton} onPress={register} disabled={busy}>
                <ThemedText style={styles.primaryButtonText}>Register</ThemedText>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={login} disabled={busy}>
                <ThemedText style={styles.secondaryButtonText}>Sign in</ThemedText>
              </Pressable>
            </View>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <ThemedText type="smallBold">Account email actions</ThemedText>
            <View style={styles.buttonRow}>
              <Pressable style={styles.secondaryButton} onPress={resendVerification} disabled={busy}>
                <ThemedText style={styles.secondaryButtonText}>Resend verification</ThemedText>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={forgotPassword} disabled={busy}>
                <ThemedText style={styles.secondaryButtonText}>Forgot password</ThemedText>
              </Pressable>
            </View>
            <View style={styles.linkRow}>
              <Link href="./verify-email" asChild>
                <Pressable>
                  <ThemedText type="linkPrimary">Open verify-email screen</ThemedText>
                </Pressable>
              </Link>
              <Link href="./reset-password" asChild>
                <Pressable>
                  <ThemedText type="linkPrimary">Open reset-password screen</ThemedText>
                </Pressable>
              </Link>
              <Link href="./profile" asChild>
                <Pressable>
                  <ThemedText type="linkPrimary">Open profile editor</ThemedText>
                </Pressable>
              </Link>
            </View>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <ThemedText type="smallBold">Session controls</ThemedText>
            <View style={styles.buttonRow}>
              <Pressable style={styles.secondaryButton} onPress={logout} disabled={busy}>
                <ThemedText style={styles.secondaryButtonText}>Sign out</ThemedText>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={logoutAll} disabled={busy}>
                <ThemedText style={styles.secondaryButtonText}>Sign out all devices</ThemedText>
              </Pressable>
            </View>
          </ThemedView>

          {busy ? <ActivityIndicator size="small" color="#3c87f7" /> : null}
          {notice ? <ThemedText themeColor="textSecondary">{notice}</ThemedText> : null}
          {error ? <ThemedText>{error}</ThemedText> : null}
        </ScrollView>
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
  },
  contentContainer: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  heroCard: {
    gap: Spacing.two,
  },
  sectionCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
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
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  linkRow: {
    gap: Spacing.one,
  },
  primaryButton: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: '#3c87f7',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: '#e8edf6',
  },
  secondaryButtonText: {
    color: '#334155',
    fontWeight: '600',
  },
});
