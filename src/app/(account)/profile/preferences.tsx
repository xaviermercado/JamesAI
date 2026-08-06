import { Link } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { clearMyFeedback } from '@/services/feedback-api';
import { getMyPreferences, getProviderCatalogForCountry, updateMyPreferences } from '@/services/profile-api';
import type {
  ContentLanguageSelection,
  CountryCatalogItem,
  LanguageCatalogItem,
  StreamingServiceCatalogItem,
  UserStreamingService,
  ViewingFormatPreference,
} from '@/types/profile';

const MAX_SELECTED_PROVIDERS = 10;

const VIEWING_FORMAT_OPTIONS: { value: ViewingFormatPreference | null; label: string }[] = [
  { value: null, label: 'No preference' },
  { value: 'subtitles_ok', label: 'Subtitles are fine' },
  { value: 'prefer_dubbed', label: 'Prefer dubbed versions' },
];

interface SavedSnapshot {
  marketCode: string;
  providerIds: number[];
  languageCodes: string[];
  viewingFormat: ViewingFormatPreference | null;
  personalizationEnabled: boolean;
}

function reorderByMove(ids: number[], providerId: number, targetIndex: number): number[] {
  const index = ids.indexOf(providerId);
  if (index === -1) return ids;
  const boundedTarget = Math.max(0, Math.min(targetIndex, ids.length - 1));
  if (boundedTarget === index) return ids;
  const next = [...ids];
  next.splice(index, 1);
  next.splice(boundedTarget, 0, providerId);
  return next;
}

export default function PreferencesScreen() {
  const { csrfToken } = useAuthSession();

  const [marketCode, setMarketCode] = useState<string>('US');
  const [selectedProviderIds, setSelectedProviderIds] = useState<number[]>([]);
  const [selectedLanguageCodes, setSelectedLanguageCodes] = useState<string[]>([]);
  const [viewingFormat, setViewingFormat] = useState<ViewingFormatPreference | null>(null);
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true);

  const [savedSnapshot, setSavedSnapshot] = useState<SavedSnapshot | null>(null);

  const [providerCatalog, setProviderCatalog] = useState<StreamingServiceCatalogItem[]>([]);
  const [providerAvailabilityKnown, setProviderAvailabilityKnown] = useState(false);
  const [countryCatalog, setCountryCatalog] = useState<CountryCatalogItem[]>([]);
  const [languageCatalog, setLanguageCatalog] = useState<LanguageCatalogItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [providerCatalogLoading, setProviderCatalogLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clearFeedbackBusy, setClearFeedbackBusy] = useState(false);
  const [clearFeedbackMessage, setClearFeedbackMessage] = useState<string | null>(null);
  const [statusAnnouncement, setStatusAnnouncement] = useState<string | null>(null);

  const [countrySearch, setCountrySearch] = useState('');
  const [providerSearch, setProviderSearch] = useState('');
  const [langSearch, setLangSearch] = useState('');
  const [draggingProviderId, setDraggingProviderId] = useState<number | null>(null);

  const saveRequestVersionRef = useRef(0);
  const providerCatalogRequestVersionRef = useRef(0);

  const filteredCountries = useMemo(
    () => countryCatalog.filter((country) => {
      const query = countrySearch.trim().toLowerCase();
      if (!query) return true;
      return country.name.toLowerCase().includes(query) || country.code.toLowerCase().includes(query);
    }),
    [countryCatalog, countrySearch],
  );

  const providerById = useMemo(
    () => new Map(providerCatalog.map((provider) => [provider.providerId, provider])),
    [providerCatalog],
  );

  const filteredProviderOptions = useMemo(() => {
    const query = providerSearch.trim().toLowerCase();
    const selected = new Set(selectedProviderIds);
    return providerCatalog.filter((provider) => {
      if (selected.has(provider.providerId)) return false;
      if (!query) return true;
      return provider.providerName.toLowerCase().includes(query);
    });
  }, [providerCatalog, providerSearch, selectedProviderIds]);

  const filteredLanguages = useMemo(
    () =>
      languageCatalog.filter((language) => {
        const query = langSearch.trim().toLowerCase();
        if (!query) return true;
        return language.name.toLowerCase().includes(query) || language.code.toLowerCase().includes(query);
      }),
    [languageCatalog, langSearch],
  );

  const selectedProviders = useMemo(
    () => selectedProviderIds
      .map((providerId) => providerById.get(providerId))
      .filter((provider): provider is StreamingServiceCatalogItem => Boolean(provider)),
    [providerById, selectedProviderIds],
  );

  const incompatibleSelectedProviderIds = useMemo(() => {
    if (!providerAvailabilityKnown) return [];
    const availableIds = new Set(providerCatalog.map((provider) => provider.providerId));
    return selectedProviderIds.filter((providerId) => !availableIds.has(providerId));
  }, [providerAvailabilityKnown, providerCatalog, selectedProviderIds]);

  const hasUnsavedChanges = useMemo(() => {
    if (!savedSnapshot) return false;
    return (
      marketCode !== savedSnapshot.marketCode
      || viewingFormat !== savedSnapshot.viewingFormat
      || personalizationEnabled !== savedSnapshot.personalizationEnabled
      || JSON.stringify(selectedProviderIds) !== JSON.stringify(savedSnapshot.providerIds)
      || JSON.stringify(selectedLanguageCodes) !== JSON.stringify(savedSnapshot.languageCodes)
    );
  }, [marketCode, personalizationEnabled, savedSnapshot, selectedLanguageCodes, selectedProviderIds, viewingFormat]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const loadCountryAwareProviders = async (country: string) => {
    const requestId = providerCatalogRequestVersionRef.current + 1;
    providerCatalogRequestVersionRef.current = requestId;
    setProviderCatalogLoading(true);

    try {
      const response = await getProviderCatalogForCountry(country);
      if (providerCatalogRequestVersionRef.current !== requestId) return;
      setProviderCatalog(response.providers);
      setProviderAvailabilityKnown(response.availabilityKnown);
    } catch {
      if (providerCatalogRequestVersionRef.current !== requestId) return;
      setProviderCatalog([]);
      setProviderAvailabilityKnown(false);
    } finally {
      if (providerCatalogRequestVersionRef.current === requestId) {
        setProviderCatalogLoading(false);
      }
    }
  };

  const setMarketDraft = (nextMarketCode: string) => {
    setMarketCode(nextMarketCode);
    void loadCountryAwareProviders(nextMarketCode);
  };

  useEffect(() => {
    let active = true;

    void getMyPreferences()
      .then(async (response) => {
        if (!active) return;

        const nextMarketCode = response.marketCode ?? 'US';
        const orderedProviderIds = [...response.streamingServices]
          .sort((a: UserStreamingService, b: UserStreamingService) => a.sortOrder - b.sortOrder)
          .map((service: UserStreamingService) => service.providerId);

        const orderedLanguageCodes = [...response.contentLanguages]
          .sort((a: ContentLanguageSelection, b: ContentLanguageSelection) => a.sortOrder - b.sortOrder)
          .map((language: ContentLanguageSelection) => language.languageCode);

        setMarketCode(nextMarketCode);
        setSelectedProviderIds(orderedProviderIds);
        setSelectedLanguageCodes(orderedLanguageCodes);
        setViewingFormat(response.viewingFormatPreference);
        setPersonalizationEnabled(response.personalizationEnabled ?? true);
        const nextCountries = [...response.catalog.countries];
        if (!nextCountries.some((country) => country.code === nextMarketCode)) {
          nextCountries.unshift({ code: nextMarketCode, name: `Unknown saved country (${nextMarketCode})` });
        }
        setCountryCatalog(nextCountries);
        setLanguageCatalog([...response.catalog.languages]);

        setSavedSnapshot({
          marketCode: nextMarketCode,
          providerIds: orderedProviderIds,
          languageCodes: orderedLanguageCodes,
          viewingFormat: response.viewingFormatPreference,
          personalizationEnabled: response.personalizationEnabled ?? true,
        });

        // Load market-aware provider choices separately to avoid stale assumptions from old payloads.
        await loadCountryAwareProviders(nextMarketCode);
      })
      .catch((error) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load your preferences right now.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const toggleLanguage = (code: string) => {
    setSelectedLanguageCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  };

  const moveLanguage = (code: string, direction: 'up' | 'down') => {
    setSelectedLanguageCodes((current) => {
      const index = current.indexOf(code);
      if (index === -1) return current;
      const next = [...current];
      const swap = direction === 'up' ? index - 1 : index + 1;
      if (swap < 0 || swap >= next.length) return current;
      [next[index], next[swap]] = [next[swap], next[index]];
      return next;
    });
  };

  const addProvider = (providerId: number) => {
    setSaveError(null);
    setSaveSuccess(false);

    setSelectedProviderIds((current) => {
      if (current.includes(providerId)) return current;
      if (current.length >= MAX_SELECTED_PROVIDERS) {
        setSaveError(`You can select up to ${MAX_SELECTED_PROVIDERS} services.`);
        return current;
      }
      return [...current, providerId];
    });
  };

  const removeProvider = (providerId: number) => {
    setSelectedProviderIds((current) => current.filter((id) => id !== providerId));
  };

  const moveProvider = (providerId: number, kind: 'up' | 'down' | 'top' | 'bottom') => {
    setSelectedProviderIds((current) => {
      const index = current.indexOf(providerId);
      if (index === -1) return current;

      let targetIndex = index;
      if (kind === 'up') targetIndex = index - 1;
      if (kind === 'down') targetIndex = index + 1;
      if (kind === 'top') targetIndex = 0;
      if (kind === 'bottom') targetIndex = current.length - 1;

      const next = reorderByMove(current, providerId, targetIndex);
      const finalPosition = next.indexOf(providerId) + 1;
      const providerName = providerById.get(providerId)?.providerName ?? 'Provider';
      setStatusAnnouncement(`${providerName} moved to position ${finalPosition}.`);
      return next;
    });
  };

  const onDropProvider = (targetProviderId: number) => {
    if (draggingProviderId === null || draggingProviderId === targetProviderId) {
      setDraggingProviderId(null);
      return;
    }

    setSelectedProviderIds((current) => {
      const targetIndex = current.indexOf(targetProviderId);
      const next = reorderByMove(current, draggingProviderId, targetIndex);
      const finalPosition = next.indexOf(draggingProviderId) + 1;
      const providerName = providerById.get(draggingProviderId)?.providerName ?? 'Provider';
      setStatusAnnouncement(`${providerName} moved to position ${finalPosition}.`);
      return next;
    });

    setDraggingProviderId(null);
  };

  const resetDraft = () => {
    if (!savedSnapshot) return;
    setMarketDraft(savedSnapshot.marketCode);
    setSelectedProviderIds(savedSnapshot.providerIds);
    setSelectedLanguageCodes(savedSnapshot.languageCodes);
    setViewingFormat(savedSnapshot.viewingFormat);
    setPersonalizationEnabled(savedSnapshot.personalizationEnabled);
    setSaveError(null);
    setSaveSuccess(false);
    setStatusAnnouncement('Draft reset to your last saved preferences.');
  };

  const performSave = async (allowProviderPrune: boolean) => {
    if (saving || !csrfToken) return;

    const requestVersion = saveRequestVersionRef.current + 1;
    saveRequestVersionRef.current = requestVersion;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    if (!countryCatalog.some((country) => country.code === marketCode)) {
      setSaving(false);
      setSaveError('Please choose a supported country from the list before saving.');
      return;
    }

    try {
      const response = await updateMyPreferences(
        {
          marketCode,
          providerIds: selectedProviderIds,
          languageCodes: selectedLanguageCodes,
          viewingFormatPreference: viewingFormat,
          personalizationEnabled,
          allowProviderPrune,
        },
        csrfToken,
      );

      if (saveRequestVersionRef.current !== requestVersion) return;

      const confirmedProviderIds = [...response.streamingServices]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((service) => service.providerId);

      const confirmedLanguageCodes = [...response.contentLanguages]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((language) => language.languageCode);

      const confirmedMarketCode = response.marketCode ?? marketCode;

      setSelectedProviderIds(confirmedProviderIds);
      setSelectedLanguageCodes(confirmedLanguageCodes);
      setMarketCode(confirmedMarketCode);
      setViewingFormat(response.viewingFormatPreference);
      setPersonalizationEnabled(response.personalizationEnabled);
      setSavedSnapshot({
        marketCode: confirmedMarketCode,
        providerIds: confirmedProviderIds,
        languageCodes: confirmedLanguageCodes,
        viewingFormat: response.viewingFormatPreference,
        personalizationEnabled: response.personalizationEnabled,
      });

      await loadCountryAwareProviders(confirmedMarketCode);

      setSaveSuccess(true);
      setStatusAnnouncement('Preferences saved.');
    } catch (error) {
      if (saveRequestVersionRef.current !== requestVersion) return;

      const message = error instanceof Error ? error.message : 'Unable to save preferences right now.';
      if (message.toLowerCase().includes('unavailable in the selected country')) {
        Alert.alert(
          'Some services are unavailable in this country',
          'You selected services that are not available in the chosen market. Remove unavailable services and save?',
          [
            { text: 'Keep editing', style: 'cancel' },
            {
              text: 'Remove unavailable and save',
              style: 'destructive',
              onPress: () => {
                void performSave(true);
              },
            },
          ],
        );
      } else {
        setSaveError(message);
      }
    } finally {
      if (saveRequestVersionRef.current === requestVersion) {
        setSaving(false);
      }
    }
  };

  const confirmClearFeedback = () => {
    if (clearFeedbackBusy || !csrfToken) return;

    Alert.alert(
      'Clear recommendation feedback?',
      'This permanently removes your feedback history. Saved country, services, language, and library history stay unchanged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear feedback',
          style: 'destructive',
          onPress: () => {
            setClearFeedbackBusy(true);
            setClearFeedbackMessage(null);
            void clearMyFeedback(csrfToken)
              .then((result) => {
                setClearFeedbackMessage(
                  result.count > 0
                    ? `Removed feedback from ${result.count} title${result.count === 1 ? '' : 's'}.`
                    : 'No saved recommendation feedback was found.',
                );
              })
              .catch((error) => {
                setClearFeedbackMessage(error instanceof Error ? error.message : 'Unable to clear feedback right now.');
              })
              .finally(() => {
                setClearFeedbackBusy(false);
              });
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={BrandColors.scoutyBlue} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.pageHeader}>
            <ThemedText type="subtitle">Profile and viewing preferences</ThemedText>
            <ThemedText themeColor="textSecondary">
              Country controls availability checks. Service order controls priority only when availability and your request permit.
            </ThemedText>
          </View>

          {loadError ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText style={styles.errorText}>{loadError}</ThemedText>
            </ThemedView>
          ) : null}

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">1. Profile identity</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              Name and optional external profile links are managed separately.
            </ThemedText>
            <Link href={'/profile/edit' as never} asChild>
              <Pressable style={styles.secondaryButton} accessibilityRole="button" accessibilityLabel="Edit profile identity">
                <ThemedText style={styles.secondaryButtonText}>Edit profile identity</ThemedText>
              </Pressable>
            </Link>
            <ThemedText themeColor="textSecondary" style={styles.hint}>Letterboxd integration is coming later.</ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">2. Country or market</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              Your country helps Scouty check where titles are available.
            </ThemedText>
            <TextInput
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search countries by name or code"
              placeholderTextColor="#8a8f98"
              style={styles.searchInput}
              accessibilityLabel="Search country"
              autoCorrect={false}
              autoCapitalize="none"
              onSubmitEditing={() => {
                if (filteredCountries.length > 0) {
                  setMarketDraft(filteredCountries[0].code);
                }
              }}
            />
            <ScrollView style={styles.selectList} nestedScrollEnabled>
              {filteredCountries.map((country) => {
                const selected = marketCode === country.code;
                return (
                  <Pressable
                    key={country.code}
                    accessibilityRole="radio"
                    accessibilityLabel={`${country.name} (${country.code})`}
                    accessibilityState={{ selected }}
                    style={[styles.listItem, selected && styles.listItemSelected]}
                    onPress={() => setMarketDraft(country.code)}
                  >
                    <ThemedText style={[styles.listItemText, selected && styles.listItemTextSelected]}>
                      {country.name} ({country.code})
                    </ThemedText>
                    {selected ? <ThemedText style={styles.checkmark}>Selected</ThemedText> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <ThemedText themeColor="textSecondary" style={styles.hint}>Saved value remains canonical 2-letter ISO code.</ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">3. Streaming services</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              Choose the services you use and arrange them in your preferred order.
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              Scouty prioritizes services near the top when they can satisfy your request, but availability and your current request still come first.
            </ThemedText>

            {providerCatalogLoading ? <ActivityIndicator size="small" color={BrandColors.scoutyBlue} /> : null}

            {providerAvailabilityKnown ? null : (
              <View style={styles.warningBanner}>
                <ThemedText style={styles.warningText}>
                  Provider availability for this country is currently limited. Scouty will keep your selected providers without assuming market-specific support.
                </ThemedText>
              </View>
            )}

            {incompatibleSelectedProviderIds.length > 0 ? (
              <View style={styles.warningBanner}>
                <ThemedText style={styles.warningText}>
                  Some selected services are unavailable in {marketCode}. Save to review and confirm removal.
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.sectionHeaderRow}>
              <ThemedText type="smallBold">Selected services ({selectedProviderIds.length}/{MAX_SELECTED_PROVIDERS})</ThemedText>
            </View>

            {selectedProviders.length === 0 ? (
              <View style={styles.anyLanguageBadge}>
                <ThemedText style={styles.anyLanguageText}>No services selected</ThemedText>
              </View>
            ) : (
              <View style={styles.selectedLanguageList}>
                {selectedProviders.map((provider, index) => {
                  const webDragProps = Platform.OS === 'web'
                    ? {
                        draggable: true,
                        onDragStart: () => setDraggingProviderId(provider.providerId),
                        onDragOver: (event: any) => event.preventDefault(),
                        onDrop: () => onDropProvider(provider.providerId),
                      }
                    : {};

                  return (
                    <View
                      key={provider.providerId}
                      style={[styles.providerRow, draggingProviderId === provider.providerId && styles.providerRowDragging]}
                      {...(webDragProps as object)}
                    >
                      <View style={styles.providerIdentity}>
                        <ThemedText style={styles.providerOrderText}>{index + 1}.</ThemedText>
                        <ThemedText style={styles.languageRowText}>{provider.providerName}</ThemedText>
                        <View style={styles.dragHandleBadge}>
                          <ThemedText style={styles.dragHandleText}>Drag</ThemedText>
                        </View>
                      </View>

                      <View style={styles.providerActionGrid}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Move ${provider.providerName} to top`}
                          style={[styles.moveLabelButton, index === 0 && styles.moveBtnDisabled]}
                          onPress={() => moveProvider(provider.providerId, 'top')}
                          disabled={index === 0}
                        >
                          <ThemedText style={styles.moveLabelText}>Top</ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Move ${provider.providerName} up`}
                          style={[styles.moveLabelButton, index === 0 && styles.moveBtnDisabled]}
                          onPress={() => moveProvider(provider.providerId, 'up')}
                          disabled={index === 0}
                        >
                          <ThemedText style={styles.moveLabelText}>Up</ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Move ${provider.providerName} down`}
                          style={[styles.moveLabelButton, index === selectedProviders.length - 1 && styles.moveBtnDisabled]}
                          onPress={() => moveProvider(provider.providerId, 'down')}
                          disabled={index === selectedProviders.length - 1}
                        >
                          <ThemedText style={styles.moveLabelText}>Down</ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Move ${provider.providerName} to bottom`}
                          style={[styles.moveLabelButton, index === selectedProviders.length - 1 && styles.moveBtnDisabled]}
                          onPress={() => moveProvider(provider.providerId, 'bottom')}
                          disabled={index === selectedProviders.length - 1}
                        >
                          <ThemedText style={styles.moveLabelText}>Bottom</ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${provider.providerName}`}
                          style={styles.removeLabelButton}
                          onPress={() => removeProvider(provider.providerId)}
                        >
                          <ThemedText style={styles.removeLabelText}>Remove</ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <TextInput
              value={providerSearch}
              onChangeText={setProviderSearch}
              placeholder="Search services to add"
              placeholderTextColor="#8a8f98"
              style={styles.searchInput}
              accessibilityLabel="Search streaming services"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <View style={styles.chipGrid}>
              {filteredProviderOptions.map((provider) => (
                <Pressable
                  key={provider.providerId}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${provider.providerName}`}
                  style={styles.chip}
                  onPress={() => addProvider(provider.providerId)}
                  disabled={selectedProviderIds.length >= MAX_SELECTED_PROVIDERS}
                >
                  <ThemedText style={styles.chipText}>+ {provider.providerName}</ThemedText>
                </Pressable>
              ))}
            </View>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">4. Language and recommendation preferences</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              Language preferences remain separate from country and service priority.
            </ThemedText>

            {selectedLanguageCodes.length > 0 ? (
              <View style={styles.selectedLanguageList}>
                <ThemedText style={styles.subLabel}>Selected (highest priority first)</ThemedText>
                {selectedLanguageCodes.map((code, index) => {
                  const language = languageCatalog.find((item) => item.code === code);
                  return (
                    <View key={code} style={styles.languageRow}>
                      <ThemedText style={styles.languageRowText}>{language?.name ?? code}</ThemedText>
                      <View style={styles.languageRowActions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Move ${language?.name ?? code} up`}
                          style={[styles.moveBtn, index === 0 && styles.moveBtnDisabled]}
                          onPress={() => moveLanguage(code, 'up')}
                          disabled={index === 0}
                        >
                          <ThemedText style={styles.moveBtnText}>Up</ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Move ${language?.name ?? code} down`}
                          style={[styles.moveBtn, index === selectedLanguageCodes.length - 1 && styles.moveBtnDisabled]}
                          onPress={() => moveLanguage(code, 'down')}
                          disabled={index === selectedLanguageCodes.length - 1}
                        >
                          <ThemedText style={styles.moveBtnText}>Down</ThemedText>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${language?.name ?? code}`}
                          style={styles.removeBtn}
                          onPress={() => toggleLanguage(code)}
                        >
                          <ThemedText style={styles.removeBtnText}>Remove</ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.anyLanguageBadge}>
                <ThemedText style={styles.anyLanguageText}>Any language</ThemedText>
              </View>
            )}

            <TextInput
              value={langSearch}
              onChangeText={setLangSearch}
              placeholder="Search languages"
              placeholderTextColor="#8a8f98"
              style={styles.searchInput}
              accessibilityLabel="Search languages"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <View style={styles.chipGrid}>
              {filteredLanguages.map((language) => {
                const selected = selectedLanguageCodes.includes(language.code);
                return (
                  <Pressable
                    key={language.code}
                    accessibilityRole="checkbox"
                    accessibilityLabel={language.name}
                    accessibilityState={{ checked: selected }}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleLanguage(language.code)}
                  >
                    <ThemedText style={[styles.chipText, selected && styles.chipTextSelected]}>{language.name}</ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.radioGroup} accessibilityRole="radiogroup">
              {VIEWING_FORMAT_OPTIONS.map((option) => {
                const selected = viewingFormat === option.value;
                return (
                  <Pressable
                    key={String(option.value)}
                    accessibilityRole="radio"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected }}
                    style={[styles.radioItem, selected && styles.radioItemSelected]}
                    onPress={() => setViewingFormat(option.value)}
                  >
                    <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                    <ThemedText style={styles.radioLabel}>{option.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">5. Privacy and account controls</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.hint}>
              Feedback, watchlist, and watched history remain separate from profile preferences.
            </ThemedText>

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <ThemedText style={styles.toggleLabel}>Use feedback to refine recommendations</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.toggleHint}>
                  {personalizationEnabled ? 'Enabled' : 'Disabled'}
                </ThemedText>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Use feedback to refine recommendations"
                accessibilityState={{ checked: personalizationEnabled }}
                style={[styles.toggleButton, personalizationEnabled && styles.toggleButtonOn]}
                onPress={() => setPersonalizationEnabled((current) => !current)}
              >
                <View style={[styles.toggleThumb, personalizationEnabled && styles.toggleThumbOn]} />
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear saved recommendation feedback"
              style={[styles.clearFeedbackButton, clearFeedbackBusy && styles.buttonDisabled]}
              onPress={confirmClearFeedback}
              disabled={clearFeedbackBusy}
            >
              {clearFeedbackBusy ? <ActivityIndicator size="small" color="#b42318" /> : <ThemedText style={styles.clearFeedbackText}>Clear saved recommendation feedback</ThemedText>}
            </Pressable>

            {clearFeedbackMessage ? (
              <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite" style={styles.feedbackStatusText}>
                {clearFeedbackMessage}
              </ThemedText>
            ) : null}
          </ThemedView>

          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset unsaved preference changes"
              style={[styles.secondaryButton, !hasUnsavedChanges && styles.buttonDisabled]}
              onPress={resetDraft}
              disabled={!hasUnsavedChanges || saving}
            >
              <ThemedText style={styles.secondaryButtonText}>Reset draft</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save preferences"
              style={[styles.primaryButton, (saving || !hasUnsavedChanges) && styles.buttonDisabled]}
              onPress={() => void performSave(false)}
              disabled={saving || !hasUnsavedChanges}
            >
              {saving ? <ActivityIndicator size="small" color="#ffffff" /> : <ThemedText style={styles.primaryButtonText}>Save preferences</ThemedText>}
            </Pressable>
          </View>

          {hasUnsavedChanges ? (
            <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite" style={styles.successText}>
              You have unsaved changes.
            </ThemedText>
          ) : null}
          {saveSuccess ? (
            <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite" style={styles.successText}>
              Preferences saved.
            </ThemedText>
          ) : null}
          {saveError ? <ThemedText style={styles.errorText} accessibilityLiveRegion="polite">{saveError}</ThemedText> : null}
          {statusAnnouncement ? <ThemedText style={styles.srStatus} accessibilityLiveRegion="polite">{statusAnnouncement}</ThemedText> : null}

          <AppFooter />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contentContainer: {
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  pageHeader: { gap: Spacing.two },
  card: {
    borderRadius: Radii.large,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  hint: { fontSize: 13, lineHeight: 18 },
  subLabel: { fontSize: 12, color: BrandColors.muted },
  warningBanner: {
    backgroundColor: '#FFF8E7',
    borderRadius: Radii.small,
    padding: Spacing.two,
    borderWidth: 1,
    borderColor: '#F5C400',
  },
  warningText: { color: '#7A5C00', fontSize: 13 },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d7dce3',
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#ffffff',
    minHeight: 44,
  },
  selectList: {
    maxHeight: 260,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.medium,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.border,
    gap: Spacing.one,
  },
  listItemSelected: { backgroundColor: '#EFF6FF' },
  listItemText: { flex: 1, fontSize: 15 },
  listItemTextSelected: { color: BrandColors.scoutyBlue, fontWeight: '600' },
  checkmark: { color: BrandColors.scoutyBlue, fontWeight: '700' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  chip: {
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    backgroundColor: '#eef3ff',
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: BrandColors.scoutyBlue },
  chipText: { color: '#334155', fontWeight: '600', fontSize: 14 },
  chipTextSelected: { color: '#ffffff' },
  anyLanguageBadge: {
    alignSelf: 'flex-start',
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    backgroundColor: '#eef3ff',
  },
  anyLanguageText: { color: '#334155', fontWeight: '600', fontSize: 14 },
  selectedLanguageList: { gap: Spacing.one },
  providerRow: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: BrandColors.border,
    gap: Spacing.one,
    backgroundColor: '#ffffff',
  },
  providerRowDragging: {
    backgroundColor: '#e0ecff',
  },
  providerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexWrap: 'wrap',
  },
  providerOrderText: {
    minWidth: 20,
    color: BrandColors.midnight800,
    fontWeight: '700',
  },
  dragHandleBadge: {
    borderRadius: Radii.pill,
    backgroundColor: '#dbeafe',
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
  },
  dragHandleText: {
    color: BrandColors.midnight800,
    fontSize: 12,
    fontWeight: '600',
  },
  providerActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  moveLabelButton: {
    minHeight: 44,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 10,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveLabelText: {
    color: BrandColors.scoutyBlue,
    fontWeight: '700',
    fontSize: 13,
  },
  removeLabelButton: {
    minHeight: 44,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 10,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeLabelText: {
    color: '#b42318',
    fontWeight: '700',
    fontSize: 13,
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: Spacing.two,
    backgroundColor: '#EFF6FF',
    borderRadius: Radii.small,
    minHeight: 44,
    gap: Spacing.one,
  },
  languageRowText: { flex: 1, fontSize: 14, fontWeight: '500' },
  languageRowActions: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  moveBtn: {
    minHeight: 44,
    borderRadius: Radii.pill,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  moveBtnDisabled: { opacity: 0.3 },
  moveBtnText: { fontSize: 13, fontWeight: '700', color: BrandColors.scoutyBlue },
  removeBtn: {
    minHeight: 44,
    borderRadius: Radii.pill,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  removeBtnText: { fontSize: 13, fontWeight: '700', color: '#b42318' },
  radioGroup: { gap: Spacing.one },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radii.small,
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  radioItemSelected: { backgroundColor: '#EFF6FF', borderColor: BrandColors.scoutyBlue },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: { borderColor: BrandColors.scoutyBlue },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BrandColors.scoutyBlue },
  radioLabel: { fontSize: 15 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  primaryButton: {
    flex: 1,
    minWidth: 160,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    minHeight: 52,
    backgroundColor: BrandColors.scoutyBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  buttonDisabled: { opacity: 0.65 },
  secondaryButton: {
    flex: 1,
    minWidth: 140,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    minHeight: 52,
    backgroundColor: '#eef3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#334155', fontWeight: '600', fontSize: 16 },
  successText: { textAlign: 'center', fontSize: 14 },
  errorText: { color: '#b42318', fontSize: 14 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  toggleCopy: { flex: 1, gap: 4 },
  toggleLabel: { fontSize: 15, fontWeight: '600' },
  toggleHint: { fontSize: 13 },
  toggleButton: {
    width: 56,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#cbd5e1',
    padding: 3,
    justifyContent: 'center',
  },
  toggleButtonOn: {
    backgroundColor: BrandColors.scoutyBlue,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    transform: [{ translateX: 0 }],
  },
  toggleThumbOn: {
    transform: [{ translateX: 24 }],
  },
  clearFeedbackButton: {
    marginTop: Spacing.one,
    minHeight: 44,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: '#f3c1bf',
    backgroundColor: '#fff5f5',
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearFeedbackText: {
    color: '#b42318',
    fontWeight: '600',
  },
  feedbackStatusText: {
    fontSize: 13,
  },
  srStatus: {
    fontSize: 12,
    color: BrandColors.muted,
    textAlign: 'center',
  },
});
