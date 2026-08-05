import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { AuthFormField } from '@/components/auth/auth-form-field';
import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { editProfileSchema } from '@/features/profile/validation';
import { getMyProfile, updateMyProfile } from '@/services/profile-api';

export default function EditProfileScreen() {
  const router = useRouter();
  const { csrfToken } = useAuthSession();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    countryCode: 'US',
    avatarUrl: '',
    letterboxdUsername: '',
    letterboxdProfileUrl: '',
    tvtimeUsername: '',
    tvtimeProfileUrl: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getMyProfile()
      .then((response) => {
        if (!active || !response.profile) {
          return;
        }

        setForm({
          firstName: response.profile.firstName ?? '',
          lastName: response.profile.lastName ?? '',
          displayName: response.profile.displayName ?? '',
          countryCode: response.profile.countryCode ?? 'US',
          avatarUrl: response.profile.avatarUrl ?? '',
          letterboxdUsername: response.profile.letterboxdUsername ?? '',
          letterboxdProfileUrl: response.profile.letterboxdProfileUrl ?? '',
          tvtimeUsername: response.profile.tvtimeUsername ?? '',
          tvtimeProfileUrl: response.profile.tvtimeProfileUrl ?? '',
        });
      })
      .catch((error) => {
        if (active) {
          setFormError(error instanceof Error ? error.message : 'Unable to load your profile right now.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setErrors({});
    setFormError(null);
    const parsed = editProfileSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        firstName: fieldErrors.firstName?.[0] ?? '',
        lastName: fieldErrors.lastName?.[0] ?? '',
        displayName: fieldErrors.displayName?.[0] ?? '',
        countryCode: fieldErrors.countryCode?.[0] ?? '',
        avatarUrl: fieldErrors.avatarUrl?.[0] ?? '',
        letterboxdUsername: fieldErrors.letterboxdUsername?.[0] ?? '',
        letterboxdProfileUrl: fieldErrors.letterboxdProfileUrl?.[0] ?? '',
        tvtimeUsername: fieldErrors.tvtimeUsername?.[0] ?? '',
        tvtimeProfileUrl: fieldErrors.tvtimeProfileUrl?.[0] ?? '',
      });
      return;
    }

    setSaving(true);
    try {
      await updateMyProfile({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        displayName: parsed.data.displayName?.trim() || null,
        countryCode: parsed.data.countryCode,
        avatarUrl: parsed.data.avatarUrl?.trim() || null,
        letterboxdUsername: parsed.data.letterboxdUsername?.trim() || null,
        letterboxdProfileUrl: parsed.data.letterboxdProfileUrl?.trim() || null,
        tvtimeUsername: parsed.data.tvtimeUsername?.trim() || null,
        tvtimeProfileUrl: parsed.data.tvtimeProfileUrl?.trim() || null,
      }, csrfToken);
      router.replace('/profile' as never);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save your profile right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <ThemedText type="subtitle">Edit profile</ThemedText>
            <ThemedText themeColor="textSecondary">Update how Scouty.ca presents your profile and region-based preferences.</ThemedText>
            {loading ? <ActivityIndicator size="small" color="#3c87f7" /> : null}
            <AuthFormField label="First name" value={form.firstName} onChangeText={(value) => updateField('firstName', value)} error={errors.firstName} autoFocus />
            <AuthFormField label="Last name" value={form.lastName} onChangeText={(value) => updateField('lastName', value)} error={errors.lastName} />
            <AuthFormField label="Display name (optional)" value={form.displayName} onChangeText={(value) => updateField('displayName', value)} error={errors.displayName} />
            <AuthFormField label="Country or region" value={form.countryCode} onChangeText={(value) => updateField('countryCode', value.toUpperCase())} error={errors.countryCode} autoCapitalize="characters" maxLength={2} />
            <AuthFormField label="Avatar URL (optional)" value={form.avatarUrl} onChangeText={(value) => updateField('avatarUrl', value)} error={errors.avatarUrl} autoCapitalize="none" />
            <AuthFormField label="Letterboxd username (optional)" value={form.letterboxdUsername} onChangeText={(value) => updateField('letterboxdUsername', value)} error={errors.letterboxdUsername} autoCapitalize="none" />
            <AuthFormField label="Letterboxd profile URL (optional)" value={form.letterboxdProfileUrl} onChangeText={(value) => updateField('letterboxdProfileUrl', value)} error={errors.letterboxdProfileUrl} autoCapitalize="none" />
            <AuthFormField label="TV Time username (optional)" value={form.tvtimeUsername} onChangeText={(value) => updateField('tvtimeUsername', value)} error={errors.tvtimeUsername} autoCapitalize="none" />
            <AuthFormField label="TV Time profile URL (optional)" value={form.tvtimeProfileUrl} onChangeText={(value) => updateField('tvtimeProfileUrl', value)} error={errors.tvtimeProfileUrl} autoCapitalize="none" />
            <ThemedText themeColor="textSecondary">Do not enter passwords for Letterboxd or TV Time. Viewing-history synchronization is not enabled yet.</ThemedText>
            <View style={styles.buttonRow}>
              <Pressable style={styles.primaryButton} onPress={() => void save()} disabled={saving || loading}>
                <ThemedText style={styles.primaryButtonText}>Save changes</ThemedText>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => router.replace('/profile' as never)}>
                <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
              </Pressable>
            </View>
            {saving ? <ActivityIndicator size="small" color="#3c87f7" /> : null}
            {formError ? <ThemedText>{formError}</ThemedText> : null}
          </View>
          <AppFooter />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  contentContainer: { maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingHorizontal: Spacing.four, paddingVertical: Spacing.four },
  card: { gap: Spacing.two, borderRadius: Radii.large, padding: Spacing.three, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  primaryButton: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, backgroundColor: BrandColors.scoutyBlue },
  primaryButtonText: { color: '#ffffff', fontWeight: '700' },
  secondaryButton: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, backgroundColor: '#eef3ff' },
  secondaryButtonText: { color: '#334155', fontWeight: '600' },
});
