import { Link, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { AuthActionRow } from '@/components/auth/auth-action-row';
import { AuthCard } from '@/components/auth/auth-card';
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
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (status === 'authenticated') {
    return <Redirect href={(redirectTo ?? '/profile') as never} />;
  }

  const submit = async () => {
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
      const session = await loginAuthAccount({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      applySession(session);
      router.replace((redirectTo ?? '/profile') as never);
    } catch (error) {
      setFormError(toSafeAuthActionMessage(error, 'Unable to log in right now.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Welcome back" description="Log in to access your saved preferences.">
      <AuthFormField label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoFocus error={errors.email} />
      <AuthFormField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" error={errors.password} />
      <Pressable accessibilityLabel="Log in" style={{ borderRadius: 999, backgroundColor: '#3c87f7', paddingHorizontal: 24, paddingVertical: 12, alignSelf: 'flex-start' }} onPress={() => void submit()} disabled={busy}>
        <ThemedText style={{ color: '#ffffff', fontWeight: '700' }}>Log in</ThemedText>
      </Pressable>
      {busy ? <ActivityIndicator size="small" color="#3c87f7" /> : null}
      {formError ? <ThemedText>{formError}</ThemedText> : null}
      <AuthActionRow>
        <Link href="/forgot-password" asChild>
          <Pressable><ThemedText type="linkPrimary">Forgot password?</ThemedText></Pressable>
        </Link>
        <Link href={redirectTo ? `/signup?redirectTo=${encodeURIComponent(redirectTo)}` : '/signup'} asChild>
          <Pressable><ThemedText type="linkPrimary">Create account</ThemedText></Pressable>
        </Link>
      </AuthActionRow>
    </AuthCard>
  );
}
