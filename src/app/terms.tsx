import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { PUBLIC_BRAND_NAME } from '@/constants/brand';
import { BrandColors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function TermsScreen() {
  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.contentContainer}>
          <View style={styles.card}>
            <ThemedText type="subtitle">Terms</ThemedText>
            <ThemedText themeColor="textSecondary">Use {PUBLIC_BRAND_NAME} responsibly and only with content providers you have legal access to.</ThemedText>
            <ThemedText themeColor="textSecondary">Detailed production terms should be reviewed with legal before launch.</ThemedText>
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