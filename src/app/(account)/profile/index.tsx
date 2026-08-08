import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { AuthFormField } from '@/components/auth/auth-form-field';
import { useAuthSession } from '@/components/auth-session-provider';
import { getScoutyAvatarAsset, scoutyAvatarOptions } from '@/constants/scouty-avatar-assets';
import { resolveAvatarId, SCOUTY_DEFAULT_AVATAR_ID, type ScoutyAvatarId } from '@/constants/scouty-avatar-catalog';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import {
  getLetterboxdStatus,
  getMyPreferences,
  getMyProfile,
  refreshLetterboxdActivity,
  updateLetterboxdSettings,
  updateMyPreferences,
  updateMyProfile,
} from '@/services/profile-api';
import type {
  CountryCatalogItem,
  LetterboxdSyncStatus,
  LanguageCatalogItem,
  StreamingServiceCatalogItem,
  ViewingFormatPreference,
} from '@/types/profile';
import { editProfileSchema } from '@/features/profile/validation';
import { normalizeProfileUsername } from '@/features/profile/username-normalization';

const VIEWING_FORMAT_LABELS: Record<string, string> = {
  no_preference: 'No preference',
  subtitles_ok: 'Subtitles are fine',
  prefer_dubbed: 'Prefer dubbed versions',
};

const AVATAR_PAGE_SIZE = 6;
const MAX_SELECTED_PROVIDERS = 10;

function countryFlag(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return '🌍';
  }

  const [a, b] = normalized;
  return String.fromCodePoint(127397 + a.charCodeAt(0), 127397 + b.charCodeAt(0));
}

export default function ProfileSummaryScreen() {
  const router = useRouter();
  const { csrfToken, user } = useAuthSession();
  const [countries, setCountries] = useState<CountryCatalogItem[]>([]);
  const [languages, setLanguages] = useState<LanguageCatalogItem[]>([]);
  const [providerCatalog, setProviderCatalog] = useState<StreamingServiceCatalogItem[]>([]);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    letterboxdUsername: '',
    tvtimeUsername: '',
  });
  const [selectedAvatarId, setSelectedAvatarId] = useState<ScoutyAvatarId>(SCOUTY_DEFAULT_AVATAR_ID);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarPage, setAvatarPage] = useState(0);
  const [marketCode, setMarketCode] = useState('US');
  const [viewingFormatPreference, setViewingFormatPreference] = useState<ViewingFormatPreference | null>(null);
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true);
  const [selectedProviderIds, setSelectedProviderIds] = useState<number[]>([]);
  const [selectedLanguageCodes, setSelectedLanguageCodes] = useState<string[]>([]);
  const [countrySearch, setCountrySearch] = useState('');
  const [providerSearch, setProviderSearch] = useState('');
  const [languageSearch, setLanguageSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [letterboxdStatus, setLetterboxdStatus] = useState<LetterboxdSyncStatus | null>(null);
  const [letterboxdBusy, setLetterboxdBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileResponse, prefsResponse, letterboxdResponse] = await Promise.all([
          getMyProfile(),
          getMyPreferences(),
          getLetterboxdStatus(),
        ]);
        if (!active) return;
        setCountries(prefsResponse.catalog.countries);
        setLanguages(prefsResponse.catalog.languages);
        setProviderCatalog(prefsResponse.catalog.providers);
        setForm({
          firstName: profileResponse.profile?.firstName ?? '',
          lastName: profileResponse.profile?.lastName ?? '',
          displayName: profileResponse.profile?.displayName ?? '',
          letterboxdUsername: profileResponse.profile?.letterboxdUsername ?? '',
          tvtimeUsername: profileResponse.profile?.tvtimeUsername ?? '',
        });
        setSelectedAvatarId(resolveAvatarId(profileResponse.profile?.avatarId));
        setMarketCode(prefsResponse.marketCode ?? profileResponse.profile?.countryCode ?? 'US');
        setViewingFormatPreference(prefsResponse.viewingFormatPreference);
        setPersonalizationEnabled(prefsResponse.personalizationEnabled ?? true);
        setSelectedProviderIds(
          [...prefsResponse.streamingServices]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((service) => service.providerId),
        );
        setSelectedLanguageCodes(
          [...prefsResponse.contentLanguages]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((language) => language.languageCode),
        );
        setLetterboxdStatus(letterboxdResponse.status);
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

  const selectedCountry = countries.find((country) => country.code === marketCode);
  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    const base = query
      ? countries.filter((country) => country.name.toLowerCase().includes(query))
      : countries;
    return base.slice(0, 10);
  }, [countries, countrySearch]);

  const providerById = useMemo(
    () => new Map(providerCatalog.map((provider) => [provider.providerId, provider])),
    [providerCatalog],
  );

  const filteredProviderOptions = useMemo(() => {
    const query = providerSearch.trim().toLowerCase();
    return providerCatalog
      .filter((provider) => !selectedProviderIds.includes(provider.providerId))
      .filter((provider) => (query ? provider.providerName.toLowerCase().includes(query) : true))
      .slice(0, 8);
  }, [providerCatalog, providerSearch, selectedProviderIds]);

  const filteredLanguageOptions = useMemo(() => {
    const query = languageSearch.trim().toLowerCase();
    return languages
      .filter((language) => !selectedLanguageCodes.includes(language.code))
      .filter((language) => (query ? language.name.toLowerCase().includes(query) : true))
      .slice(0, 10);
  }, [languageSearch, languages, selectedLanguageCodes]);

  const avatarPageCount = Math.max(1, Math.ceil(scoutyAvatarOptions.length / AVATAR_PAGE_SIZE));
  const avatarChoices = scoutyAvatarOptions.slice(avatarPage * AVATAR_PAGE_SIZE, (avatarPage + 1) * AVATAR_PAGE_SIZE);

  const saveAll = async () => {
    if (!csrfToken || saving) return;

    setErrors({});
    setError(null);
    setStatusMessage(null);
    const parsed = editProfileSchema.safeParse({
      firstName: form.firstName,
      lastName: form.lastName,
      displayName: form.displayName,
      countryCode: marketCode,
      letterboxdUsername: form.letterboxdUsername,
      tvtimeUsername: form.tvtimeUsername,
    });

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        firstName: fieldErrors.firstName?.[0] ?? '',
        lastName: fieldErrors.lastName?.[0] ?? '',
        displayName: fieldErrors.displayName?.[0] ?? '',
        letterboxdUsername: fieldErrors.letterboxdUsername?.[0] ?? '',
        tvtimeUsername: fieldErrors.tvtimeUsername?.[0] ?? '',
      });
      return;
    }

    let normalizedLetterboxd = '';
    let normalizedTvTime = '';
    try {
      normalizedLetterboxd = normalizeProfileUsername('letterboxd', form.letterboxdUsername);
      normalizedTvTime = normalizeProfileUsername('tvtime', form.tvtimeUsername);
    } catch (normalizationError) {
      setError(normalizationError instanceof Error ? normalizationError.message : 'Invalid profile username.');
      return;
    }

    setSaving(true);
    try {
      await updateMyPreferences({
        marketCode,
        providerIds: selectedProviderIds,
        languageCodes: selectedLanguageCodes,
        viewingFormatPreference,
        personalizationEnabled,
      }, csrfToken);

      await updateMyProfile({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        displayName: parsed.data.displayName?.trim() || null,
        countryCode: marketCode,
        avatarId: selectedAvatarId,
        letterboxdUsername: normalizedLetterboxd || null,
        tvtimeUsername: normalizedTvTime || null,
        viewingFormatPreference,
      }, csrfToken);
      setStatusMessage('Profile and preferences saved.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save your profile right now.');
    } finally {
      setSaving(false);
    }
  };

  const removeProvider = (providerId: number) => {
    setSelectedProviderIds((current) => current.filter((item) => item !== providerId));
  };

  const addProvider = (providerId: number) => {
    setSelectedProviderIds((current) => {
      if (current.includes(providerId) || current.length >= MAX_SELECTED_PROVIDERS) {
        return current;
      }
      return [...current, providerId];
    });
  };

  const removeLanguage = (languageCode: string) => {
    setSelectedLanguageCodes((current) => current.filter((item) => item !== languageCode));
  };

  const addLanguage = (languageCode: string) => {
    setSelectedLanguageCodes((current) => (current.includes(languageCode) ? current : [...current, languageCode]));
  };

  const profileName = [form.firstName, form.lastName].filter(Boolean).join(' ').trim() || form.displayName || 'Your profile';
  const letterboxdStatusText = letterboxdStatus
    ? letterboxdStatus.rssStatus === 'ok'
      ? 'Public activity synced'
      : letterboxdStatus.rssStatus === 'error'
        ? 'Last refresh failed'
        : 'No refresh run yet'
    : 'Loading sync status...';

  const toggleLetterboxdSync = async () => {
    if (!csrfToken || letterboxdBusy || !letterboxdStatus) {
      return;
    }
    setLetterboxdBusy(true);
    setError(null);
    try {
      const response = await updateLetterboxdSettings(!letterboxdStatus.enabled, csrfToken);
      setLetterboxdStatus(response.status);
      setStatusMessage(response.status.enabled ? 'Letterboxd public sync enabled.' : 'Letterboxd public sync disabled.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to update Letterboxd sync settings right now.');
    } finally {
      setLetterboxdBusy(false);
    }
  };

  const refreshLetterboxd = async () => {
    if (!csrfToken || letterboxdBusy) {
      return;
    }
    setLetterboxdBusy(true);
    setError(null);
    try {
      const response = await refreshLetterboxdActivity(csrfToken);
      setLetterboxdStatus(response.status);
      setStatusMessage(
        response.changed
          ? `Letterboxd refreshed. Imported ${response.importedCount} watched title${response.importedCount === 1 ? '' : 's'}.`
          : 'Letterboxd checked. No new activity found.',
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to refresh Letterboxd activity right now.');
      try {
        const statusResponse = await getLetterboxdStatus();
        setLetterboxdStatus(statusResponse.status);
      } catch {
        // best-effort status refresh only
      }
    } finally {
      setLetterboxdBusy(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <ThemedText type="subtitle">Profile</ThemedText>
            <ThemedText themeColor="textSecondary">Keep your profile and recommendation settings in one friendly place.</ThemedText>
          </View>

          {loading ? <ActivityIndicator size="small" color={BrandColors.scoutyBlue} /> : null}
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <ThemedText type="smallBold">1. Profile identity and Scouty avatar</ThemedText>
            <Image
              source={getScoutyAvatarAsset(
                avatarFailed
                  ? SCOUTY_DEFAULT_AVATAR_ID
                  : selectedAvatarId,
              )}
              style={styles.avatar}
              contentFit="contain"
              onError={() => setAvatarFailed(true)}
              accessibilityLabel="Scouty profile avatar"
            />
            <ThemedText type="smallBold">{profileName}</ThemedText>
            <Pressable style={styles.secondaryButton} onPress={() => setAvatarPickerOpen((current) => !current)}>
              <ThemedText style={styles.secondaryButtonText}>{avatarPickerOpen ? 'Close avatar picker' : 'Change avatar'}</ThemedText>
            </Pressable>
            {avatarPickerOpen ? (
              <View style={styles.avatarPickerPanel} accessibilityRole="radiogroup" accessibilityLabel="Scouty avatar choices">
                <View style={styles.avatarPickerGrid}>
                  {avatarChoices.map((option) => {
                    const selected = option.id === selectedAvatarId;
                    return (
                      <Pressable
                        key={option.id}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={option.label}
                        style={[styles.avatarOption, selected && styles.avatarOptionSelected]}
                        onPress={() => setSelectedAvatarId(option.id)}
                      >
                        <Image source={option.source} style={styles.avatarOptionImage} contentFit="contain" accessible={false} />
                        <ThemedText style={styles.avatarOptionLabel}>{option.label}</ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.inlineRow}>
                  <Pressable style={styles.secondaryButton} onPress={() => setAvatarPage((page) => Math.max(0, page - 1))} disabled={avatarPage === 0}>
                    <ThemedText style={styles.secondaryButtonText}>Previous</ThemedText>
                  </Pressable>
                  <ThemedText themeColor="textSecondary">Page {avatarPage + 1} of {avatarPageCount}</ThemedText>
                  <Pressable style={styles.secondaryButton} onPress={() => setAvatarPage((page) => Math.min(avatarPageCount - 1, page + 1))} disabled={avatarPage >= avatarPageCount - 1}>
                    <ThemedText style={styles.secondaryButtonText}>Next</ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : null}
            <AuthFormField label="First name" value={form.firstName} onChangeText={(value) => setForm((current) => ({ ...current, firstName: value }))} error={errors.firstName} />
            <AuthFormField label="Last name" value={form.lastName} onChangeText={(value) => setForm((current) => ({ ...current, lastName: value }))} error={errors.lastName} />
            <AuthFormField label="Display name (optional)" value={form.displayName} onChangeText={(value) => setForm((current) => ({ ...current, displayName: value }))} error={errors.displayName} />
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <ThemedText type="smallBold">2. Public entertainment profiles</ThemedText>
            <ThemedText themeColor="textSecondary">Add usernames only. If you paste a supported profile URL, Scouty will extract the username.</ThemedText>
            <AuthFormField
              label="Letterboxd username"
              value={form.letterboxdUsername}
              onChangeText={(value) => setForm((current) => ({ ...current, letterboxdUsername: value }))}
              autoCapitalize="none"
              error={errors.letterboxdUsername}
            />
            <AuthFormField
              label="TV Time username"
              value={form.tvtimeUsername}
              onChangeText={(value) => setForm((current) => ({ ...current, tvtimeUsername: value }))}
              autoCapitalize="none"
              error={errors.tvtimeUsername}
            />
            <View style={styles.sectionInset}>
              <ThemedText type="smallBold">Letterboxd watched-history sync</ThemedText>
              <ThemedText themeColor="textSecondary">Status: {letterboxdStatusText}</ThemedText>
              <ThemedText themeColor="textSecondary">Imported from public activity: {letterboxdStatus?.rssCount ?? 0} titles</ThemedText>
              {letterboxdStatus?.lastSuccessfulRefreshAt ? (
                <ThemedText themeColor="textSecondary">Last successful refresh: {new Date(letterboxdStatus.lastSuccessfulRefreshAt).toLocaleString()}</ThemedText>
              ) : null}
              {letterboxdStatus?.lastErrorMessage ? <ThemedText style={styles.errorText}>{letterboxdStatus.lastErrorMessage}</ThemedText> : null}
              <View style={styles.inlineRow}>
                <Pressable style={styles.secondaryButton} onPress={() => void toggleLetterboxdSync()} disabled={letterboxdBusy}>
                  <ThemedText style={styles.secondaryButtonText}>{letterboxdStatus?.enabled ? 'Disable public sync' : 'Enable public sync'}</ThemedText>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => void refreshLetterboxd()} disabled={letterboxdBusy || !letterboxdStatus?.enabled}>
                  <ThemedText style={styles.secondaryButtonText}>{letterboxdBusy ? 'Refreshing...' : 'Refresh now'}</ThemedText>
                </Pressable>
              </View>
            </View>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <ThemedText type="smallBold">3. Country</ThemedText>
            <ThemedText themeColor="textSecondary">Your selected country is used to check streaming availability.</ThemedText>
            <TextInput
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search country"
              placeholderTextColor="#8a8f98"
              style={styles.searchInput}
              accessibilityLabel="Search country"
            />
            <View style={styles.selectList}>
              {filteredCountries.map((country) => {
                const selected = country.code === marketCode;
                return (
                  <Pressable
                    key={country.code}
                    style={[styles.listRow, selected && styles.listRowSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${country.name}`}
                    onPress={() => setMarketCode(country.code)}
                  >
                    <ThemedText>{countryFlag(country.code)} {country.name}</ThemedText>
                    {selected ? <ThemedText themeColor="textSecondary">Selected</ThemedText> : null}
                  </Pressable>
                );
              })}
            </View>
            <ThemedText themeColor="textSecondary">Current: {selectedCountry ? `${countryFlag(selectedCountry.code)} ${selectedCountry.name}` : marketCode}</ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <ThemedText type="smallBold">4. Streaming services</ThemedText>
            <ThemedText themeColor="textSecondary">Select the services you actually use. You can remove any service with one tap.</ThemedText>
            <View style={styles.chipList}>
              {selectedProviderIds.length === 0 ? <ThemedText themeColor="textSecondary">No services selected yet.</ThemedText> : null}
              {selectedProviderIds.map((providerId) => {
                const provider = providerById.get(providerId);
                if (!provider) return null;
                return (
                  <View key={provider.providerId} style={styles.selectionRow}>
                    <ThemedText style={styles.selectionLabel}>{provider.logoPath ? '🎬' : '📺'} {provider.providerName}</ThemedText>
                    <Pressable style={styles.removeButton} onPress={() => removeProvider(provider.providerId)}>
                      <ThemedText style={styles.removeButtonText}>Remove</ThemedText>
                    </Pressable>
                  </View>
                );
              })}
            </View>
            <TextInput
              value={providerSearch}
              onChangeText={setProviderSearch}
              placeholder="Add service"
              placeholderTextColor="#8a8f98"
              style={styles.searchInput}
              accessibilityLabel="Search streaming services"
            />
            <View style={styles.selectList}>
              {filteredProviderOptions.map((provider) => (
                <Pressable key={provider.providerId} style={styles.listRow} onPress={() => addProvider(provider.providerId)} accessibilityRole="button" accessibilityLabel={`Add ${provider.providerName}`}>
                  <ThemedText>{provider.providerName}</ThemedText>
                  <ThemedText themeColor="textSecondary">Add</ThemedText>
                </Pressable>
              ))}
            </View>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <ThemedText type="smallBold">5. Recommendation languages</ThemedText>
            <ThemedText themeColor="textSecondary">Pick languages you enjoy. Remove any language with one tap.</ThemedText>
            <View style={styles.chipList}>
              {selectedLanguageCodes.length === 0 ? <ThemedText themeColor="textSecondary">No preferred languages selected. Scouty can suggest any language.</ThemedText> : null}
              {selectedLanguageCodes.map((languageCode) => {
                const language = languages.find((item) => item.code === languageCode);
                return (
                  <View key={languageCode} style={styles.selectionRow}>
                    <ThemedText style={styles.selectionLabel}>{language?.name ?? languageCode}</ThemedText>
                    <Pressable style={styles.removeButton} onPress={() => removeLanguage(languageCode)}>
                      <ThemedText style={styles.removeButtonText}>Remove</ThemedText>
                    </Pressable>
                  </View>
                );
              })}
            </View>
            <TextInput
              value={languageSearch}
              onChangeText={setLanguageSearch}
              placeholder="Add language"
              placeholderTextColor="#8a8f98"
              style={styles.searchInput}
              accessibilityLabel="Search languages"
            />
            <View style={styles.selectList}>
              {filteredLanguageOptions.map((language) => (
                <Pressable key={language.code} style={styles.listRow} onPress={() => addLanguage(language.code)} accessibilityRole="button" accessibilityLabel={`Add ${language.name}`}>
                  <ThemedText>{language.name}</ThemedText>
                  <ThemedText themeColor="textSecondary">Add</ThemedText>
                </Pressable>
              ))}
            </View>
            <View style={styles.inlineRow}>
              {Object.entries(VIEWING_FORMAT_LABELS).map(([value, label]) => {
                const selected = viewingFormatPreference === value;
                return (
                  <Pressable key={value} style={[styles.secondaryButton, selected && styles.selectedInlineButton]} onPress={() => setViewingFormatPreference(value as ViewingFormatPreference)}>
                    <ThemedText style={styles.secondaryButtonText}>{label}</ThemedText>
                  </Pressable>
                );
              })}
              <Pressable style={[styles.secondaryButton, viewingFormatPreference === null && styles.selectedInlineButton]} onPress={() => setViewingFormatPreference(null)}>
                <ThemedText style={styles.secondaryButtonText}>No preference</ThemedText>
              </Pressable>
            </View>
            <Pressable style={[styles.secondaryButton, personalizationEnabled && styles.selectedInlineButton]} onPress={() => setPersonalizationEnabled((current) => !current)}>
              <ThemedText style={styles.secondaryButtonText}>{personalizationEnabled ? 'Personalization enabled' : 'Personalization disabled'}</ThemedText>
            </Pressable>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.sectionCard}>
            <ThemedText type="smallBold">6. Save your profile</ThemedText>
            <ThemedText themeColor="textSecondary">Email: {user?.email ?? '—'}</ThemedText>
            <ThemedText themeColor="textSecondary">
              {user?.emailVerifiedAt ? 'Email verified' : 'Email not yet verified'}
            </ThemedText>
            <View style={styles.buttonRow}>
              <Pressable style={[styles.primaryButton, saving && { opacity: 0.65 }]} onPress={() => void saveAll()} disabled={saving}>
                <ThemedText style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save Changes'}</ThemedText>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => router.replace('/' as never)}>
                <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
              </Pressable>
            </View>
            {statusMessage ? <ThemedText themeColor="textSecondary">{statusMessage}</ThemedText> : null}
            {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
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
  selectedInlineButton: { backgroundColor: '#dbeafe' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#f8fafc' },
  avatarPickerPanel: { gap: Spacing.two, borderWidth: 1, borderColor: BrandColors.border, borderRadius: Radii.medium, padding: Spacing.two },
  avatarPickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  avatarOption: { width: '48%', borderWidth: 1, borderColor: BrandColors.border, borderRadius: Radii.medium, padding: Spacing.one, gap: Spacing.one, alignItems: 'center' },
  avatarOptionSelected: { borderColor: BrandColors.scoutyBlue, backgroundColor: '#ecf3ff' },
  avatarOptionImage: { width: 64, height: 64 },
  avatarOptionLabel: { fontSize: 12, textAlign: 'center' },
  sectionInset: {
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.medium,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: 10,
    minHeight: 44,
  },
  selectList: { gap: Spacing.one },
  listRow: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listRowSelected: { backgroundColor: '#ecf3ff', borderColor: BrandColors.scoutyBlue },
  chipList: { gap: Spacing.one },
  selectionRow: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  selectionLabel: { flexShrink: 1 },
  removeButton: {
    borderRadius: Radii.pill,
    backgroundColor: '#fee2e2',
    paddingHorizontal: Spacing.two,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  removeButtonText: { color: '#b42318', fontWeight: '600' },
  inlineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, alignItems: 'center' },
  errorText: { color: '#b42318' },
});
