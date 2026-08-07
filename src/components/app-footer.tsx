import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ENGINE_CREDIT, PUBLIC_BRAND_NAME } from '@/constants/brand';
import { BrandColors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';

export function AppFooter() {
  return (
    <View style={styles.footerWrap}>
      <View style={styles.footerInner}>
        <View style={styles.linkRow}>
          <Link href={'/about' as never} asChild><ThemedText type="linkPrimary" style={styles.footerLink}>About</ThemedText></Link>
          <Link href={'/contact' as never} asChild><ThemedText type="linkPrimary" style={styles.footerLink}>Contact</ThemedText></Link>
          <Link href={'/privacy' as never} asChild><ThemedText type="linkPrimary" style={styles.footerLink}>Privacy</ThemedText></Link>
          <Link href={'/terms' as never} asChild><ThemedText type="linkPrimary" style={styles.footerLink}>Terms</ThemedText></Link>
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