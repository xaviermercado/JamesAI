import { Link, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { AuthActionRow } from '@/components/auth/auth-action-row';
import { AuthCard, authPrimaryButtonStyle, authPrimaryTextStyle } from '@/components/auth/auth-card';
import { AuthFormField } from '@/components/auth/auth-form-field';
import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedText } from '@/components/themed-text';
import { toSafeAuthActionMessage } from '@/features/auth/error-messages';
import { getSafeRedirectPath } from '@/features/auth/redirect';
import { loginFormSchema } from '@/features/auth/validation';
import { loginAuthAccount } from '@/services/auth-api';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirectTo?: string }>();
  const redirectTo = useMemo(() => getSafeRedirectPath(params.redirectTo), [params.redirectTo]);
  const { status, applySession } = useAuthSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (status === 'authenticated') {
    return <Redirect href={(redirectTo ?? '/') as never} />;
  }

  const submit = async () => {
    if (busy) return;
    setErrors({});
    setFormError(null);
    const parsed = loginFormSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        email: fieldErrors.email?.[0] ?? '',
        password: fieldErrors.password?.[0] ?? '',
      });
      return;
    }

    setBusy(true);
    try {
      const session = await loginAuthAccount({ email: parsed.data.email, password: parsed.data.password });
      applySession(session);
      router.replace((redirectTo ?? '/') as never);
    } catch (error) {
      setFormError(toSafeAuthActionMessage(error, 'Unable to log in right now.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Welcome back" description="Log in to access your saved preferences.">
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
        error={errors.email}
      />
      <AuthFormField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!passwordVisible}
        autoCapitalize="none"
        textContentType="password"
        autoComplete="current-password"
        rightAccessory={(
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
            onPress={() => setPasswordVisible((current) => !current)}
            style={styles.passwordToggle}
          >
            <ThemedText style={styles.passwordToggleText}>{passwordVisible ? '🙈' : '👁'}</ThemedText>
          </Pressable>
        )}
        error={errors.password}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log in"
        style={[authPrimaryButtonStyle, busy && { opacity: 0.65 }]}
        onPress={() => void submit()}
        disabled={busy}
      >
        {busy
          ? <ActivityIndicator size="small" color="#ffffff" />
          : <ThemedText style={authPrimaryTextStyle}>Log in</ThemedText>}
      </Pressable>
      {formError ? <ThemedText style={{ color: '#b42318', fontSize: 14 }} accessibilityLiveRegion="polite">{formError}</ThemedText> : null}
      <AuthActionRow>
        <Link href="/forgot-password" asChild>
          <Pressable accessibilityRole="link"><ThemedText type="linkPrimary">Forgot password?</ThemedText></Pressable>
        </Link>
        <Link href={redirectTo ? `/signup?redirectTo=${encodeURIComponent(redirectTo)}` : '/signup'} asChild>
          <Pressable accessibilityRole="link"><ThemedText type="linkPrimary">Create account</ThemedText></Pressable>
        </Link>
      </AuthActionRow>
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  passwordToggle: {
    minHeight: 36,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  passwordToggleText: {
    fontSize: 18,
  },
});
