import { Link, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, Fonts, MaxContentWidth, Radii, Spacing } from '@/constants/theme';

const ADMIN_ROUTES = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/guidance', label: 'Guidance' },
  { href: '/admin/sandbox', label: 'Sandbox' },
  { href: '/admin/versions', label: 'Versions' },
  { href: '/admin/feedback', label: 'Feedback' },
  { href: '/admin/audit', label: 'Audit' },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <ThemedView style={styles.root}>
      <AppHeader />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View {...({ role: 'navigation' } as unknown as object)} accessibilityLabel="Admin navigation" style={styles.navWrap}>
          <View style={styles.navInner}>
            <ThemedText style={styles.adminLabel}>Scouty Admin</ThemedText>
            <View style={styles.navLinks}>
              {ADMIN_ROUTES.map((route) => {
                const selected = pathname === route.href;
                return (
                  <Link key={route.href} href={route.href as never} asChild>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityState={{ selected }}
                      style={{ ...styles.navLink, ...(selected ? styles.navLinkSelected : {}) }}
                    >
                      <ThemedText style={{ ...styles.navText, ...(selected ? styles.navTextSelected : {}) }}>{route.label}</ThemedText>
                    </Pressable>
                  </Link>
                );
              })}
            </View>
          </View>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

export function AdminPage({ title, description, actions, children }: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View {...({ role: 'main' } as unknown as object)} style={styles.page}>
      <View style={styles.pageHeader}>
        <View style={styles.pageHeading}>
          <ThemedText type="subtitle" accessibilityRole="header">{title}</ThemedText>
          <ThemedText themeColor="textSecondary">{description}</ThemedText>
        </View>
        {actions ? <View style={styles.pageActions}>{actions}</View> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  navWrap: { width: '100%', backgroundColor: BrandColors.midnight900 },
  navInner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.three, gap: Spacing.two },
  adminLabel: { color: BrandColors.surface, fontFamily: Fonts.display, fontSize: 18, fontWeight: 800 },
  navLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  navLink: { minHeight: 44, paddingHorizontal: Spacing.three, justifyContent: 'center', borderRadius: Radii.small },
  navLinkSelected: { backgroundColor: BrandColors.surface },
  navText: { color: 'rgba(255,255,255,0.78)', fontFamily: Fonts.display, fontSize: 14, fontWeight: 700 },
  navTextSelected: { color: BrandColors.midnight900 },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.three, paddingBottom: Spacing.six },
  page: { width: '100%', gap: Spacing.four },
  pageHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.three },
  pageHeading: { flex: 1, minWidth: 260, maxWidth: 760, gap: Spacing.one },
  pageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});