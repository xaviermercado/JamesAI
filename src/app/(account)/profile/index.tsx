import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { logoutAllAuthDevices, logoutAuthAccount } from '@/services/auth-api';
import { getMyProfile, getMyStreamingServices } from '@/services/profile-api';
import type { UserProfile, UserStreamingService } from '@/types/profile';

export default function ProfileSummaryScreen() {
  const router = useRouter();
  const { csrfToken, clearSession, user } = useAuthSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [services, setServices] = useState<UserStreamingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileResponse, servicesResponse] = await Promise.all([getMyProfile(), getMyStreamingServices()]);
        if (!active) {
          return;
        }
        setProfile(profileResponse.profile);
        setServices(servicesResponse.services);
      } catch (nextError) {
        if (!active) {
          return;
        }
        setError(nextError instanceof Error ? nextError.message : 'Unable to load your profile right now.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const logOut = async (allDevices: boolean) => {
    if (!csrfToken) {
      return;
    }

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

  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <ThemedText type="subtitle">Profile</ThemedText>
            <ThemedText themeColor="textSecondary">Review your saved account details and recommendation preferences.</ThemedText>
          </View>

          {loading ? <ActivityIndicator size="small" color="#3c87f7" /> : null}
          {error ? <ThemedText>{error}</ThemedText> : null}

          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            {profile?.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} /> : null}
            <ThemedText type="smallBold">{profileName}</ThemedText>
            {profile?.displayName && profile.displayName !== profileName ? <ThemedText themeColor="textSecondary">Display name: {profile.displayName}</ThemedText> : null}
            <ThemedText themeColor="textSecondary">Country or region: {profile?.countryCode ?? 'Not set yet'}</ThemedText>
            <ThemedText themeColor="textSecondary">Email: {user?.email ?? '—'}</ThemedText>
            <ThemedText themeColor="textSecondary">
              {user?.emailVerifiedAt ? 'Email verified' : 'Email not yet verified'}
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <ThemedText type="smallBold">Streaming services</ThemedText>
            <ThemedText themeColor="textSecondary">{services.length ? services.map((service) => service.providerName).join(', ') : 'No streaming services selected yet.'}</ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <ThemedText type="smallBold">Public profiles</ThemedText>
            <ThemedText themeColor="textSecondary">Letterboxd: {profile?.letterboxdProfileUrl || profile?.letterboxdUsername || 'Not connected'}</ThemedText>
            <ThemedText themeColor="textSecondary">TV Time: {profile?.tvtimeProfileUrl || profile?.tvtimeUsername || 'Not connected'}</ThemedText>
            <ThemedText themeColor="textSecondary">Viewing-history synchronization is not enabled yet.</ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <View style={styles.buttonRow}>
              <Link href={'/profile/edit' as never} asChild>
                <Pressable style={styles.primaryButton}>
                  <ThemedText style={styles.primaryButtonText}>Edit profile</ThemedText>
                </Pressable>
              </Link>
              <Link href={'/profile/streaming-services' as never} asChild>
                <Pressable style={styles.secondaryButton}>
                  <ThemedText style={styles.secondaryButtonText}>Manage streaming services</ThemedText>
                </Pressable>
              </Link>
            </View>
          </ThemedView>

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
  avatar: { width: 88, height: 88, borderRadius: 44 },
});
