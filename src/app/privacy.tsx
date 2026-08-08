import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { PUBLIC_BRAND_NAME } from '@/constants/brand';
import { BrandColors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function PrivacyScreen() {
  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.contentContainer}>
          <View style={styles.card}>
            <ThemedText type="subtitle">Privacy</ThemedText>
            <ThemedText themeColor="textSecondary">{PUBLIC_BRAND_NAME} stores the account details and preferences needed to personalize recommendations and secure your sign-in session.</ThemedText>
            <ThemedText themeColor="textSecondary">If you add a Letterboxd username and enable public activity sync, {PUBLIC_BRAND_NAME} fetches only your public Letterboxd RSS activity feed from letterboxd.com using your explicit request.</ThemedText>
            <ThemedText themeColor="textSecondary">We store normalized title/year watch-history signals from that feed so recommendations can avoid movies you have already seen. We do not scrape non-public pages and do not use unofficial APIs.</ThemedText>
            <ThemedText themeColor="textSecondary">You can disable Letterboxd public sync at any time from your profile. Existing imported entries may still be retained according to operational retention policies unless deleted by support tooling.</ThemedText>
            <ThemedText themeColor="textSecondary">We use Google Analytics to understand aggregate site usage and improve {PUBLIC_BRAND_NAME}. Google may process device, browser, approximate location, and interaction data according to its privacy terms.</ThemedText>
            <ThemedText themeColor="textSecondary">Detailed production privacy copy should still be reviewed with legal before launch.</ThemedText>
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