import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { BrandColors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

interface AuthCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <View style={styles.header}>
                <ThemedText type="subtitle">{title}</ThemedText>
                <ThemedText themeColor="textSecondary">{description}</ThemedText>
              </View>
              {children}
            </View>
            <AppFooter />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.four,
  },
  card: {
    backgroundColor: BrandColors.surface,
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: BrandColors.border,
    boxShadow: '0 10px 30px rgba(11, 22, 51, 0.08)',
    marginTop: Spacing.two,
  },
  header: {
    gap: Spacing.two,
  },
});