import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getMyStreamingServices, updateMyStreamingServices } from '@/services/profile-api';
import type { StreamingServiceCatalogItem } from '@/types/profile';

export default function StreamingServicesScreen() {
  const router = useRouter();
  const { csrfToken } = useAuthSession();
  const [catalog, setCatalog] = useState<StreamingServiceCatalogItem[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getMyStreamingServices()
      .then((response) => {
        if (!active) {
          return;
        }
        setCatalog(response.catalog);
        setSelected(response.services.map((service) => service.providerId));
      })
      .catch((nextError) => {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to load streaming services right now.');
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

  const toggle = (providerId: number) => {
    setSelected((current) => (current.includes(providerId) ? current.filter((id) => id !== providerId) : [...current, providerId]));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await updateMyStreamingServices(selected, csrfToken);
      setSelected(response.services.map((service) => service.providerId));
      router.replace('/profile' as never);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save streaming services right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.contentContainer}>
          <View style={styles.card}>
            <ThemedText type="subtitle">Manage streaming services</ThemedText>
            <ThemedText themeColor="textSecondary">Choose the services you want JamesAI to prioritize in recommendations. Viewing-history synchronization is not enabled yet.</ThemedText>
            {loading ? <ActivityIndicator size="small" color="#3c87f7" /> : null}
            <View style={styles.pillGrid}>
              {catalog.map((service) => {
                const active = selected.includes(service.providerId);
                return (
                  <Pressable key={service.providerId} accessibilityLabel={`Toggle ${service.providerName}`} style={[styles.pill, active && styles.pillActive]} onPress={() => toggle(service.providerId)}>
                    <ThemedText style={[styles.pillText, active && styles.pillTextActive]}>{service.providerName}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.buttonRow}>
              <Pressable style={styles.primaryButton} onPress={() => void save()} disabled={saving || loading}>
                <ThemedText style={styles.primaryButtonText}>Save services</ThemedText>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => router.replace('/profile' as never)}>
                <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
              </Pressable>
            </View>
            {saving ? <ActivityIndicator size="small" color="#3c87f7" /> : null}
            {error ? <ThemedText>{error}</ThemedText> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  contentContainer: { maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingHorizontal: Spacing.four, paddingVertical: Spacing.four },
  card: { gap: Spacing.three, borderRadius: Spacing.three, padding: Spacing.three, backgroundColor: '#f0f0f3' },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, backgroundColor: '#e8edf6' },
  pillActive: { backgroundColor: '#3c87f7' },
  pillText: { color: '#334155', fontWeight: '600' },
  pillTextActive: { color: '#ffffff' },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  primaryButton: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, backgroundColor: '#3c87f7' },
  primaryButtonText: { color: '#ffffff', fontWeight: '700' },
  secondaryButton: { borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, backgroundColor: '#e8edf6' },
  secondaryButtonText: { color: '#334155', fontWeight: '600' },
});
