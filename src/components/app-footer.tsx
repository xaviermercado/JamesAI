import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAnalyticsConsent } from '@/components/analytics-consent-provider';
import { ENGINE_CREDIT, PUBLIC_BRAND_NAME } from '@/constants/brand';
import { BrandColors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

export function AppFooter() {
  const { openPreferences } = useAnalyticsConsent();

  return (
    <View style={styles.footerWrap}>
      <View style={styles.footerInner}>
        <View style={styles.linkRow}>
          <Link href={'/about' as never} asChild><ThemedText type="linkPrimary" style={styles.footerLink}>About</ThemedText></Link>
          <Link href={'/contact' as never} asChild><ThemedText type="linkPrimary" style={styles.footerLink}>Contact</ThemedText></Link>
          <Link href={'/privacy' as never} asChild><ThemedText type="linkPrimary" style={styles.footerLink}>Privacy</ThemedText></Link>
          <Link href={'/terms' as never} asChild><ThemedText type="linkPrimary" style={styles.footerLink}>Terms</ThemedText></Link>
          <Pressable accessibilityRole="button" onPress={openPreferences}><ThemedText type="linkPrimary" style={styles.footerLink}>Analytics preferences</ThemedText></Pressable>
        </View>
        <ThemedText themeColor="textSecondary" style={styles.footerCopy}>{ENGINE_CREDIT}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.footerCopy}>© {new Date().getFullYear()} {PUBLIC_BRAND_NAME}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footerWrap: {
    width: '100%',
    backgroundColor: BrandColors.midnight900,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    marginTop: Spacing.six,
  },
  footerInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.two,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  footerLink: {
    color: BrandColors.surface,
    fontFamily: Fonts.display,
  },
  footerCopy: {
    color: 'rgba(255,255,255,0.72)',
  },
});