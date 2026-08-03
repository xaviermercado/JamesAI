import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getMyProfile, updateMyProfile, type UpdateUserProfileInput } from '@/services/profile-api';

export default function ProfileScreen() {
  const { status, csrfToken } = useAuthSession();

  const [displayName, setDisplayName] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [letterboxdUsername, setLetterboxdUsername] = useState('');
  const [letterboxdProfileUrl, setLetterboxdProfileUrl] = useState('');
  const [tvtimeUsername, setTvtimeUsername] = useState('');
  const [tvtimeProfileUrl, setTvtimeProfileUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    const load = async () => {
      setLoading(true);
      setMessage(null);
      setError(null);
      try {
        const response = await getMyProfile();
        if (!response.profile) {
          setMessage('No profile exists yet. Fill the form and save to create one.');
          return;
        }

        setDisplayName(response.profile.displayName ?? '');
        setCountryCode(response.profile.countryCode ?? 'US');
        setAvatarUrl(response.profile.avatarUrl ?? '');
        setLetterboxdUsername(response.profile.letterboxdUsername ?? '');
        setLetterboxdProfileUrl(response.profile.letterboxdProfileUrl ?? '');
        setTvtimeUsername(response.profile.tvtimeUsername ?? '');
        setTvtimeProfileUrl(response.profile.tvtimeProfileUrl ?? '');
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Unable to load profile.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [status]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);

    const payload: UpdateUserProfileInput = {
      displayName: displayName.trim(),
      countryCode: countryCode.trim().toUpperCase(),
      avatarUrl: avatarUrl.trim() || null,
      letterboxdUsername: letterboxdUsername.trim() || null,
      letterboxdProfileUrl: letterboxdProfileUrl.trim() || null,
      tvtimeUsername: tvtimeUsername.trim() || null,
      tvtimeProfileUrl: tvtimeProfileUrl.trim() || null,
    };

    try {
      const response = await updateMyProfile(payload, csrfToken);
      setDisplayName(response.profile.displayName ?? '');
      setCountryCode(response.profile.countryCode ?? 'US');
      setAvatarUrl(response.profile.avatarUrl ?? '');
      setLetterboxdUsername(response.profile.letterboxdUsername ?? '');
      setLetterboxdProfileUrl(response.profile.letterboxdProfileUrl ?? '');
      setTvtimeUsername(response.profile.tvtimeUsername ?? '');
      setTvtimeProfileUrl(response.profile.tvtimeProfileUrl ?? '');
      setMessage('Profile saved.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.card}>
            <ThemedText type="subtitle">Profile</ThemedText>
            <ThemedText themeColor="textSecondary">Checking your sign-in status...</ThemedText>
            <ActivityIndicator size="small" color="#3c87f7" />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (status !== 'authenticated') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.card}>
            <ThemedText type="subtitle">Profile</ThemedText>
            <ThemedText themeColor="textSecondary">
              You are not signed in, so profile editing is locked.
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Go to Account Center to sign in, then return here.
            </ThemedText>
            <Link href="/explore" asChild>
              <Pressable style={styles.secondaryButton}>
                <ThemedText style={styles.secondaryButtonText}>Go to account center</ThemedText>
              </Pressable>
            </Link>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <ThemedText type="subtitle">Edit profile</ThemedText>
            <ThemedText themeColor="textSecondary">These fields match the Phase 1 profiles table and are ready for backend profile endpoints.</ThemedText>

            <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Display name" style={styles.input} />
            <TextInput value={countryCode} onChangeText={setCountryCode} autoCapitalize="characters" maxLength={2} placeholder="Country code (US)" style={styles.input} />
            <TextInput value={avatarUrl} onChangeText={setAvatarUrl} autoCapitalize="none" placeholder="Avatar URL" style={styles.input} />
            <TextInput value={letterboxdUsername} onChangeText={setLetterboxdUsername} autoCapitalize="none" placeholder="Letterboxd username" style={styles.input} />
            <TextInput value={letterboxdProfileUrl} onChangeText={setLetterboxdProfileUrl} autoCapitalize="none" placeholder="Letterboxd profile URL" style={styles.input} />
            <TextInput value={tvtimeUsername} onChangeText={setTvtimeUsername} autoCapitalize="none" placeholder="TV Time username" style={styles.input} />
            <TextInput value={tvtimeProfileUrl} onChangeText={setTvtimeProfileUrl} autoCapitalize="none" placeholder="TV Time profile URL" style={styles.input} />

            <View style={styles.row}>
              <Pressable style={styles.primaryButton} onPress={save} disabled={saving}>
                <ThemedText style={styles.primaryButtonText}>Save profile</ThemedText>
              </Pressable>
              <Link href="/explore" asChild>
                <Pressable style={styles.secondaryButton}>
                  <ThemedText style={styles.secondaryButtonText}>Back to account</ThemedText>
                </Pressable>
              </Link>
            </View>

            {loading || saving ? <ActivityIndicator size="small" color="#3c87f7" /> : null}
            {message ? <ThemedText themeColor="textSecondary">{message}</ThemedText> : null}
            {error ? <ThemedText>{error}</ThemedText> : null}
          </View>
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
  },
  card: {
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.three,
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
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
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
