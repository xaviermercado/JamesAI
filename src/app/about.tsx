import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { ENGINE_CREDIT, PUBLIC_BRAND_NAME } from '@/constants/brand';
import { BrandColors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function AboutScreen() {
  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.contentContainer}>
          <View style={styles.card}>
            <ThemedText type="subtitle">About {PUBLIC_BRAND_NAME}</ThemedText>
            <ThemedText themeColor="textSecondary">Scouty.ca is powered by FrostApps.ca.</ThemedText>
            <ThemedText themeColor="textSecondary">{ENGINE_CREDIT}</ThemedText>
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
  contentContainer: { maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingHorizontal: Spacing.four, paddingVertical: Spacing.four, gap: Spacing.four },
  card: { borderRadius: Radii.large, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border, padding: Spacing.four, gap: Spacing.two },
});