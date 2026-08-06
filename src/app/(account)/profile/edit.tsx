import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { AuthFormField } from '@/components/auth/auth-form-field';
import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getScoutyAvatarAsset, scoutyAvatarOptions } from '@/constants/scouty-avatar-assets';
import { resolveAvatarId, SCOUTY_DEFAULT_AVATAR_ID, type ScoutyAvatarId } from '@/constants/scouty-avatar-catalog';
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
    letterboxdUsername: '',
    letterboxdProfileUrl: '',
    tvtimeUsername: '',
    tvtimeProfileUrl: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState<string | null>(null);
  const [confirmedAvatarId, setConfirmedAvatarId] = useState<ScoutyAvatarId>(SCOUTY_DEFAULT_AVATAR_ID);
  const [draftAvatarId, setDraftAvatarId] = useState<ScoutyAvatarId>(SCOUTY_DEFAULT_AVATAR_ID);
  const [failedAvatarOptions, setFailedAvatarOptions] = useState<Set<ScoutyAvatarId>>(new Set());
  const saveRequestIdRef = useRef(0);

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
          letterboxdUsername: response.profile.letterboxdUsername ?? '',
          letterboxdProfileUrl: response.profile.letterboxdProfileUrl ?? '',
          tvtimeUsername: response.profile.tvtimeUsername ?? '',
          tvtimeProfileUrl: response.profile.tvtimeProfileUrl ?? '',
        });
        const initialAvatarId = resolveAvatarId(response.profile.avatarId);
        setConfirmedAvatarId(initialAvatarId);
        setDraftAvatarId(initialAvatarId);
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
    setStatusAnnouncement(null);
    const parsed = editProfileSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        firstName: fieldErrors.firstName?.[0] ?? '',
        lastName: fieldErrors.lastName?.[0] ?? '',
        displayName: fieldErrors.displayName?.[0] ?? '',
        countryCode: fieldErrors.countryCode?.[0] ?? '',
        letterboxdUsername: fieldErrors.letterboxdUsername?.[0] ?? '',
        letterboxdProfileUrl: fieldErrors.letterboxdProfileUrl?.[0] ?? '',
        tvtimeUsername: fieldErrors.tvtimeUsername?.[0] ?? '',
        tvtimeProfileUrl: fieldErrors.tvtimeProfileUrl?.[0] ?? '',
      });
      return;
    }

    setSaving(true);
    const requestId = saveRequestIdRef.current + 1;
    saveRequestIdRef.current = requestId;

    try {
      const response = await updateMyProfile({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        displayName: parsed.data.displayName?.trim() || null,
        countryCode: parsed.data.countryCode,
        avatarId: draftAvatarId,
        letterboxdUsername: parsed.data.letterboxdUsername?.trim() || null,
        letterboxdProfileUrl: parsed.data.letterboxdProfileUrl?.trim() || null,
        tvtimeUsername: parsed.data.tvtimeUsername?.trim() || null,
        tvtimeProfileUrl: parsed.data.tvtimeProfileUrl?.trim() || null,
      }, csrfToken);

      if (requestId !== saveRequestIdRef.current) {
        return;
      }

      const savedAvatarId = resolveAvatarId(response.profile.avatarId);
      setConfirmedAvatarId(savedAvatarId);
      setDraftAvatarId(savedAvatarId);
      setStatusAnnouncement('Profile changes saved.');
      router.replace('/profile' as never);
    } catch (error) {
      if (requestId !== saveRequestIdRef.current) {
        return;
      }
      setFormError(error instanceof Error ? error.message : 'Unable to save your profile right now.');
      setStatusAnnouncement('Unable to save profile changes. You can review and retry.');
    } finally {
      if (requestId === saveRequestIdRef.current) {
        setSaving(false);
      }
    }
  };

  const selectedAvatarLabel = scoutyAvatarOptions.find((option) => option.id === draftAvatarId)?.label ?? 'Smiling Scouty';

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

            <View style={styles.avatarPickerSection}>
              <ThemedText type="smallBold">Choose your Scouty avatar</ThemedText>
              <ThemedText themeColor="textSecondary">Selected: {selectedAvatarLabel}</ThemedText>
              <View style={styles.selectedAvatarPreview}>
                <Image source={getScoutyAvatarAsset(draftAvatarId)} style={styles.selectedAvatarImage} contentFit="contain" accessibilityLabel={selectedAvatarLabel} />
              </View>
              <View accessibilityRole="radiogroup" accessibilityLabel="Choose your Scouty avatar" style={styles.avatarGrid}>
                {scoutyAvatarOptions.map((option) => {
                  const isSelected = option.id === draftAvatarId;
                  const source = failedAvatarOptions.has(option.id)
                    ? getScoutyAvatarAsset(SCOUTY_DEFAULT_AVATAR_ID)
                    : option.source;

                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      accessibilityLabel={option.label}
                      onPress={() => setDraftAvatarId(option.id)}
                      style={[styles.avatarOption, isSelected ? styles.avatarOptionSelected : null]}>
                      <Image
                        source={source}
                        style={styles.avatarOptionImage}
                        contentFit="contain"
                        accessible={false}
                        onError={() => {
                          setFailedAvatarOptions((current) => {
                            const next = new Set(current);
                            next.add(option.id);
                            return next;
                          });
                        }}
                      />
                      <ThemedText style={styles.avatarOptionLabel}>{option.label}</ThemedText>
                      {isSelected ? <ThemedText style={styles.avatarSelectedBadge}>Selected</ThemedText> : null}
                    </Pressable>
                  );
                })}
              </View>
              {confirmedAvatarId !== draftAvatarId ? (
                <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">Avatar selection has unsaved changes.</ThemedText>
              ) : null}
            </View>

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
            {formError ? <ThemedText accessibilityLiveRegion="polite">{formError}</ThemedText> : null}
            {statusAnnouncement ? <ThemedText style={styles.srStatus} accessibilityLiveRegion="polite">{statusAnnouncement}</ThemedText> : null}
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
  avatarPickerSection: { gap: Spacing.two, marginTop: Spacing.two, marginBottom: Spacing.two },
  selectedAvatarPreview: {
    alignSelf: 'flex-start',
    width: 120,
    height: 120,
    borderRadius: Radii.large,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: Spacing.one,
    backgroundColor: '#f8fafc',
  },
  selectedAvatarImage: { width: '100%', height: '100%' },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  avatarOption: {
    width: '48%',
    minHeight: 180,
    minWidth: 150,
    borderRadius: Radii.large,
    borderWidth: 2,
    borderColor: BrandColors.border,
    padding: Spacing.two,
    backgroundColor: '#ffffff',
    gap: Spacing.one,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  avatarOptionSelected: {
    borderColor: BrandColors.scoutyBlue,
    backgroundColor: '#eaf2ff',
  },
  avatarOptionImage: {
    width: '100%',
    height: 108,
    minHeight: 108,
  },
  avatarOptionLabel: {
    textAlign: 'center',
    minHeight: 40,
  },
  avatarSelectedBadge: {
    fontWeight: '700',
    color: '#0f172a',
  },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  primaryButton: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, backgroundColor: BrandColors.scoutyBlue },
  primaryButtonText: { color: '#ffffff', fontWeight: '700' },
  secondaryButton: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, backgroundColor: '#eef3ff' },
  secondaryButtonText: { color: '#334155', fontWeight: '600' },
  srStatus: {
    position: 'absolute',
    width: 1,
    height: 1,
    margin: -1,
    padding: 0,
    borderWidth: 0,
    overflow: 'hidden',
  },
});
