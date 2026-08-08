import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AuthSessionProvider } from '@/components/auth-session-provider';
import { AnalyticsConsentProvider } from '@/components/analytics-consent-provider';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SeoMetadata } from '@/components/seo-metadata';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnalyticsConsentProvider>
        <SeoMetadata />
        <AuthSessionProvider>
          <AnimatedSplashOverlay />
          <Slot />
        </AuthSessionProvider>
      </AnalyticsConsentProvider>
    </ThemeProvider>
  );
}
