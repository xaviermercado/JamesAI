import { Link, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { useAuthSession } from '@/components/auth-session-provider';
import { getScoutyAvatarAsset } from '@/constants/scouty-avatar-assets';
import { resolveAvatarId, SCOUTY_DEFAULT_AVATAR_ID } from '@/constants/scouty-avatar-catalog';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { logoutAllAuthDevices, logoutAuthAccount } from '@/services/auth-api';
import { getMyPreferences, getMyProfile } from '@/services/profile-api';
import type { ContentLanguageSelection, UserPreferences, UserProfile } from '@/types/profile';

const VIEWING_FORMAT_LABELS: Record<string, string> = {
  no_preference: 'No preference',
  subtitles_ok: 'Subtitles are fine',
  prefer_dubbed: 'Prefer dubbed versions',
};

export default function ProfileSummaryScreen() {
  const router = useRouter();
  const { csrfToken, clearSession, user } = useAuthSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [countryNames, setCountryNames] = useState<Record<string, string>>({});
  const [languageNames, setLanguageNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileResponse, prefsResponse] = await Promise.all([getMyProfile(), getMyPreferences()]);
        if (!active) return;
        setProfile(profileResponse.profile);
        setPreferences(prefsResponse);
        setCountryNames(
          Object.fromEntries(prefsResponse.catalog.countries.map((c) => [c.code, c.name])),
        );
        setLanguageNames(
          Object.fromEntries(prefsResponse.catalog.languages.map((l) => [l.code, l.name])),
        );
      } catch (nextError) {
        if (!active) return;
        setError(nextError instanceof Error ? nextError.message : 'Unable to load your profile right now.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, []);

  const logOut = async (allDevices: boolean) => {
    if (!csrfToken) return;
    setBusy(true);
    try {
      if (allDevices) {
        await logoutAllAuthDevices(csrfToken);
      } else {
        await logoutAuthAccount(csrfToken);
      }
      clearSession();
      router.replace('/');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to sign out right now.');
    } finally {
      setBusy(false);
    }
  };

  const profileName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() || profile?.displayName || 'Your profile';

  const sortedLanguages = [...(preferences?.contentLanguages ?? [])]
    .sort((a: ContentLanguageSelection, b: ContentLanguageSelection) => a.sortOrder - b.sortOrder);

  const marketName = preferences?.marketCode ? (countryNames[preferences.marketCode] ?? preferences.marketCode) : null;

  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <ThemedText type="subtitle">Profile</ThemedText>
            <ThemedText themeColor="textSecondary">Review your saved account details and recommendation preferences.</ThemedText>
          </View>

          {loading ? <ActivityIndicator size="small" color={BrandColors.scoutyBlue} /> : null}
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          {/* Account info */}
          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <Image
              source={getScoutyAvatarAsset(
                avatarFailed
                  ? SCOUTY_DEFAULT_AVATAR_ID
                  : resolveAvatarId(profile?.avatarId),
              )}
              style={styles.avatar}
              contentFit="contain"
              onError={() => setAvatarFailed(true)}
              accessibilityLabel="Scouty profile avatar"
            />
            <ThemedText type="smallBold">{profileName}</ThemedText>
            {profile?.displayName && profile.displayName !== profileName ? (
              <ThemedText themeColor="textSecondary">Display name: {profile.displayName}</ThemedText>
            ) : null}
            <ThemedText themeColor="textSecondary">Email: {user?.email ?? '—'}</ThemedText>
            <ThemedText themeColor="textSecondary">
              {user?.emailVerifiedAt ? 'Email verified' : 'Email not yet verified'}
            </ThemedText>
          </ThemedView>

          {/* Viewing preferences */}
          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <ThemedText type="smallBold">Viewing preferences</ThemedText>

            {!preferences || (!preferences.marketCode && preferences.streamingServices.length === 0 && preferences.contentLanguages.length === 0) ? (
              <ThemedText themeColor="textSecondary" style={styles.emptyState}>
                Tell Scouty where and how you like to watch, and your preferences will be ready for future recommendations.
              </ThemedText>
            ) : (
              <>
                <ThemedText themeColor="textSecondary">
                  Streaming region: {marketName ?? 'Not set'}
                </ThemedText>
                <ThemedText themeColor="textSecondary">
                  Streaming services: {
                    preferences.streamingServices.length > 0
                      ? preferences.streamingServices.map((s) => s.providerName).join(', ')
                      : 'None selected'
                  }
                </ThemedText>
                <ThemedText themeColor="textSecondary">
                  Content languages: {
                    sortedLanguages.length > 0
                      ? sortedLanguages.map((l) => languageNames[l.languageCode] ?? l.languageCode).join(', ')
                      : 'Any language'
                  }
                </ThemedText>
                {preferences.viewingFormatPreference ? (
                  <ThemedText themeColor="textSecondary">
                    Subtitles/dubbing: {VIEWING_FORMAT_LABELS[preferences.viewingFormatPreference] ?? preferences.viewingFormatPreference}
                  </ThemedText>
                ) : null}
              </>
            )}
          </ThemedView>

          {/* Actions */}
          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <View style={styles.buttonRow}>
              <Link href={'/profile/library' as never} asChild>
                <Pressable style={styles.primaryButton}>
                  <ThemedText style={styles.primaryButtonText}>Open library</ThemedText>
                </Pressable>
              </Link>
              <Link href={'/profile/edit' as never} asChild>
                <Pressable style={styles.secondaryButton}>
                  <ThemedText style={styles.secondaryButtonText}>Edit profile</ThemedText>
                </Pressable>
              </Link>
              <Link href={'/profile/preferences' as never} asChild>
                <Pressable style={styles.secondaryButton}>
                  <ThemedText style={styles.secondaryButtonText}>Edit preferences</ThemedText>
                </Pressable>
              </Link>
            </View>
          </ThemedView>

          {/* Public profiles */}
          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <ThemedText type="smallBold">Public profiles</ThemedText>
            <ThemedText themeColor="textSecondary">Letterboxd: {profile?.letterboxdProfileUrl || profile?.letterboxdUsername || 'Not connected'}</ThemedText>
            <ThemedText themeColor="textSecondary">TV Time: {profile?.tvtimeProfileUrl || profile?.tvtimeUsername || 'Not connected'}</ThemedText>
            <ThemedText themeColor="textSecondary">Viewing-history synchronization is not enabled yet.</ThemedText>
          </ThemedView>

          {/* Security */}
          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <ThemedText type="smallBold">Security</ThemedText>
            <View style={styles.buttonRow}>
              <Pressable style={styles.secondaryButton} onPress={() => void logOut(false)} disabled={busy}>
                <ThemedText style={styles.secondaryButtonText}>Log out</ThemedText>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => void logOut(true)} disabled={busy}>
                <ThemedText style={styles.secondaryButtonText}>Log out from all devices</ThemedText>
              </Pressable>
            </View>
          </ThemedView>
          <AppFooter />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  contentContainer: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  heroCard: { gap: Spacing.two },
  sectionCard: { borderRadius: Radii.large, padding: Spacing.three, gap: Spacing.two, borderWidth: 1, borderColor: BrandColors.border },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  primaryButton: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, backgroundColor: BrandColors.scoutyBlue },
  primaryButtonText: { color: '#ffffff', fontWeight: '700' },
  secondaryButton: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, backgroundColor: '#eef3ff' },
  secondaryButtonText: { color: '#334155', fontWeight: '600' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#f8fafc' },
  emptyState: { fontStyle: 'italic' },
  errorText: { color: '#b42318' },
});
