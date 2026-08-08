import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BrandColors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { analytics, resolveInitialAnalyticsConsent, type AnalyticsConsent } from '@/services/analytics';

const STORAGE_KEY = 'scouty.analytics-consent.v1';

interface AnalyticsConsentContextValue {
  consent: AnalyticsConsent;
  openPreferences: () => void;
}

const AnalyticsConsentContext = createContext<AnalyticsConsentContextValue | null>(null);

function readStoredConsent(): AnalyticsConsent {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'unset';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'accepted' || stored === 'declined' ? stored : 'unset';
  } catch {
    return 'unset';
  }
}

export function AnalyticsConsentProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<AnalyticsConsent>('unset');
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const hydrationTimer = window.setTimeout(() => {
      const stored = readStoredConsent();
      const initialConsent = resolveInitialAnalyticsConsent(stored);
      setConsent(initialConsent);
      setNoticeOpen(stored === 'unset');
      analytics.setConsent(initialConsent);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!hydrated || consent !== 'accepted') return;
    let active = true;
    void analytics.enable().then((enabled) => {
      if (active && enabled) analytics.trackPageView(pathname);
    });
    return () => { active = false; };
  }, [consent, hydrated, pathname]);

  const choose = (nextConsent: Exclude<AnalyticsConsent, 'unset'>) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, nextConsent);
    } catch {
      // Consent still applies for this page when storage is unavailable.
    }
    analytics.setConsent(nextConsent);
    setConsent(nextConsent);
    setNoticeOpen(false);
    setPreferencesOpen(false);
  };

  return (
    <AnalyticsConsentContext.Provider value={{ consent, openPreferences: () => setPreferencesOpen(true) }}>
      {children}
      {Platform.OS === 'web' && hydrated && noticeOpen ? (
        <View accessibilityRole="alert" style={styles.banner}>
          <View style={styles.bannerInner}>
            <View style={styles.copyBlock}>
              <ThemedText type="subtitle" style={styles.lightText}>Analytics preferences</ThemedText>
              <ThemedText style={styles.bodyText}>Scouty uses Google Analytics by default to understand aggregate site usage. You can opt out now or anytime without affecting recommendations or account features.</ThemedText>
            </View>
            <View style={styles.actions}>
              <ConsentButton label="Keep analytics" onPress={() => choose('accepted')} />
              <ConsentButton label="Decline analytics" onPress={() => choose('declined')} />
            </View>
          </View>
        </View>
      ) : null}
      <Modal visible={preferencesOpen} transparent animationType="fade" onRequestClose={() => setPreferencesOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View role="dialog" accessibilityLabel="Analytics preferences" style={styles.modalPanel}>
            <ThemedText type="subtitle">Analytics preferences</ThemedText>
            <ThemedText themeColor="textSecondary">Optional analytics is currently {consent === 'accepted' ? 'accepted' : 'declined'}. You can change this choice at any time.</ThemedText>
            <View style={styles.modalActions}>
              <ConsentButton label="Accept analytics" onPress={() => choose('accepted')} dark />
              <ConsentButton label="Decline analytics" onPress={() => choose('declined')} dark />
              <Pressable accessibilityRole="button" style={styles.closeButton} onPress={() => setPreferencesOpen(false)}>
                <ThemedText type="linkPrimary">Close</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AnalyticsConsentContext.Provider>
  );
}

function ConsentButton({ label, onPress, dark = false }: { label: string; onPress: () => void; dark?: boolean }) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.choiceButton, dark && styles.choiceButtonDark, focused && styles.focused, pressed && styles.pressed]}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
    >
      <ThemedText style={[styles.choiceText, dark && styles.choiceTextDark]}>{label}</ThemedText>
    </Pressable>
  );
}

export function useAnalyticsConsent() {
  const context = useContext(AnalyticsConsentContext);
  if (!context) throw new Error('useAnalyticsConsent must be used within AnalyticsConsentProvider');
  return context;
}

const styles = StyleSheet.create({
  banner: { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: BrandColors.midnight900, padding: Spacing.three },
  bannerInner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  copyBlock: { flexGrow: 1, flexShrink: 1, flexBasis: 440, gap: Spacing.one },
  lightText: { color: BrandColors.surface },
  bodyText: { color: 'rgba(255,255,255,0.84)', lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choiceButton: { minHeight: 48, borderRadius: Radii.medium, borderWidth: 2, borderColor: BrandColors.surface, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, justifyContent: 'center' },
  choiceButtonDark: { borderColor: BrandColors.midnight900 },
  choiceText: { color: BrandColors.surface, fontWeight: '700', textAlign: 'center' },
  choiceTextDark: { color: BrandColors.midnight900 },
  focused: { outlineStyle: 'solid', outlineWidth: 3, outlineColor: BrandColors.scoutyBlue, outlineOffset: 3 },
  pressed: { opacity: 0.72 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(7,21,47,0.62)', alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  modalPanel: { width: '100%', maxWidth: 520, borderRadius: Radii.medium, backgroundColor: BrandColors.surface, padding: Spacing.four, gap: Spacing.three },
  modalActions: { gap: Spacing.two },
  closeButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
});
