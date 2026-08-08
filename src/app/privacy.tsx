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
            <ThemedText themeColor="textSecondary">{PUBLIC_BRAND_NAME} stores the account details, private library data, and preferences needed to provide recommendations and secure your sign-in session. Essential authentication and security storage works independently from optional analytics.</ThemedText>
            <ThemedText themeColor="textSecondary">If you add a Letterboxd username and enable public activity sync, {PUBLIC_BRAND_NAME} fetches only your public Letterboxd RSS activity feed from letterboxd.com using your explicit request.</ThemedText>
            <ThemedText themeColor="textSecondary">We store normalized title/year watch-history signals from that feed so recommendations can avoid movies you have already seen. We do not scrape non-public pages and do not use unofficial APIs.</ThemedText>
            <ThemedText themeColor="textSecondary">You can disable Letterboxd public sync at any time from your profile. Existing imported entries may still be retained according to operational retention policies unless deleted by support tooling.</ThemedText>
            <ThemedText themeColor="textSecondary">By default, we use Google Analytics to understand aggregate site usage and improve {PUBLIC_BRAND_NAME}. Google may process browser, device, approximate location, page category, and approved interaction data under its own privacy terms. Scouty does not send Google your name, email, account ID, raw recommendation request, contact message, Letterboxd username, exact title history, or token-bearing URL.</ThemedText>
            <ThemedText themeColor="textSecondary">Google Analytics is enabled when you first visit unless you previously declined it. The analytics notice lets you keep analytics or opt out, and you can change your choice at any time using “Analytics preferences” in the footer. Declining does not affect Scouty functionality, stops future collection, and prompts Scouty to remove first-party Google Analytics cookies; browser or domain restrictions may prevent deleting every existing cookie automatically.</ThemedText>
            <ThemedText themeColor="textSecondary">Scouty also keeps minimal first-party operational events to measure recommendation reliability and quality, registration, email delivery, contact delivery, and Letterboxd sync outcomes. These records contain coarse buckets and request-scoped random correlation IDs, not user IDs, IP addresses, user agents, prompts, titles, messages, full URLs, or reusable device identifiers.</ThemedText>
            <ThemedText themeColor="textSecondary">Raw operational events are retained for up to 90 days. Daily non-identifying aggregates may be retained longer for product reporting. Service providers involved in Scouty include hosting, database, email, movie metadata, recommendation, Letterboxd RSS, and, while analytics is enabled, Google Analytics providers.</ThemedText>
            <ThemedText themeColor="textSecondary">Privacy questions can be sent through the Contact page. This notice and its retention choices require owner/legal review before production analytics is enabled.</ThemedText>
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