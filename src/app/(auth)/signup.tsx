import { Link, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { AuthActionRow } from '@/components/auth/auth-action-row';
import { AuthCard, authPrimaryButtonStyle, authPrimaryTextStyle } from '@/components/auth/auth-card';
import { AuthFormField } from '@/components/auth/auth-form-field';
import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedText } from '@/components/themed-text';
import { toSafeAuthActionMessage } from '@/features/auth/error-messages';
import { getSafeRedirectPath } from '@/features/auth/redirect';
import { signupFormSchema } from '@/features/auth/validation';
import { registerAuthAccount } from '@/services/auth-api';

export default function SignupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirectTo?: string }>();
  const redirectTo = useMemo(() => getSafeRedirectPath(params.redirectTo), [params.redirectTo]);
  const { status } = useAuthSession();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (status === 'authenticated') {
    return <Redirect href={(redirectTo ?? '/profile') as never} />;
  }

  const submit = async () => {
    if (busy) return;
    setErrors({});
    setFormError(null);
    const parsed = signupFormSchema.safeParse({ firstName, lastName, email, password, confirmPassword });
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        firstName: fieldErrors.firstName?.[0] ?? '',
        lastName: fieldErrors.lastName?.[0] ?? '',
        email: fieldErrors.email?.[0] ?? '',
        password: fieldErrors.password?.[0] ?? '',
        confirmPassword: fieldErrors.confirmPassword?.[0] ?? '',
      });
      return;
    }

    setBusy(true);
    try {
      await registerAuthAccount({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        password: parsed.data.password,
      });
      router.replace(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
    } catch (error) {
      setFormError(toSafeAuthActionMessage(error, 'Unable to create your account right now.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Create your Scouty.ca profile" description="Save your preferences and get recommendations that fit you.">
      <AuthFormField
        label="First name"
        value={firstName}
        onChangeText={setFirstName}
        autoCapitalize="words"
        textContentType="givenName"
        autoComplete="given-name"
        autoFocus
        error={errors.firstName}
      />
      <AuthFormField
        label="Last name"
        value={lastName}
        onChangeText={setLastName}
        autoCapitalize="words"
        textContentType="familyName"
        autoComplete="family-name"
        error={errors.lastName}
      />
      <AuthFormField
        label="Email address"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        error={errors.email}
      />
      <AuthFormField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
        autoComplete="new-password"
        hint="At least 12 characters"
        error={errors.password}
      />
      <AuthFormField
        label="Confirm password"
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
        accessibilityLabel="Create account"
        style={[authPrimaryButtonStyle, busy && { opacity: 0.65 }]}
        onPress={() => void submit()}
        disabled={busy}
      >
        {busy
          ? <ActivityIndicator size="small" color="#ffffff" />
          : <ThemedText style={authPrimaryTextStyle}>Create account</ThemedText>}
      </Pressable>
      {formError ? <ThemedText style={{ color: '#b42318', fontSize: 14 }} accessibilityLiveRegion="polite">{formError}</ThemedText> : null}
      <AuthActionRow>
        <Link href={redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : '/login'} asChild>
          <Pressable accessibilityRole="link"><ThemedText type="linkPrimary">Log in</ThemedText></Pressable>
        </Link>
        <ThemedText themeColor="textSecondary" style={{ fontSize: 13 }}>By continuing, you agree to our Terms and Privacy policy.</ThemedText>
      </AuthActionRow>
    </AuthCard>
  );
}
