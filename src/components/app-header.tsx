import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { PUBLIC_BRAND_NAME, scoutyHeroMascot } from '@/constants/brand';
import { BrandColors, Fonts, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedText } from '@/components/themed-text';

function navButtonStyle(kind: 'primary' | 'ghost') {
  return ({ hovered, pressed }: { hovered: boolean; pressed: boolean }) => ({
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    minHeight: 44,
    backgroundColor: kind === 'primary' ? BrandColors.scoutyCoral : 'transparent',
    borderWidth: kind === 'ghost' ? 1 : 0,
    borderColor: kind === 'ghost' ? 'rgba(255,255,255,0.2)' : 'transparent',
    opacity: pressed ? 0.9 : 1,
    transform: [{ translateY: hovered && Platform.OS === 'web' ? -1 : 0 }],
  });
}

export function AppHeader() {
  const { status } = useAuthSession();
  const profileLabel = 'Profile';

  return (
    <View style={styles.headerWrap}>
      <View style={styles.headerInner}>
        <Link href="/" asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={`${PUBLIC_BRAND_NAME} home`} style={styles.brandLink}>
            <Image source={scoutyHeroMascot} style={styles.brandMark} contentFit="contain" accessibilityLabel="Scouty mascot" />
            <ThemedText style={styles.brandText}>{PUBLIC_BRAND_NAME}</ThemedText>
          </Pressable>
        </Link>

        <View style={styles.actionsRow}>
          {status === 'authenticated' ? (
            <Link href={'/profile' as never} asChild>
              <Pressable accessibilityRole="link" accessibilityLabel="Open your profile" style={navButtonStyle('ghost')}>
                <ThemedText style={styles.ghostText}>{profileLabel}</ThemedText>
              </Pressable>
            </Link>
          ) : (
            <>
              <Link href="/login" asChild>
                <Pressable accessibilityRole="link" accessibilityLabel="Log in" style={navButtonStyle('ghost')}>
                  <ThemedText style={styles.ghostText}>Log in</ThemedText>
                </Pressable>
              </Link>
              <Link href="/signup" asChild>
                <Pressable accessibilityRole="link" accessibilityLabel="Create account" style={navButtonStyle('primary')}>
                  <ThemedText style={styles.primaryText}>Create account</ThemedText>
                </Pressable>
              </Link>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    width: '100%',
    backgroundColor: BrandColors.midnight900,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  headerInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  brandLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
  },
  brandMark: {
    width: 42,
    height: 42,
  },
  brandText: {
    color: BrandColors.surface,
    fontFamily: Fonts.display,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    alignItems: 'center',
  },
  ghostText: {
    color: BrandColors.surface,
    fontFamily: Fonts.display,
    fontWeight: '700',
  },
  primaryText: {
    color: BrandColors.surface,
    fontFamily: Fonts.display,
    fontWeight: '700',
  },
});