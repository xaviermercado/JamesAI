import { Redirect, Slot, usePathname } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedView } from '@/components/themed-view';

export default function AccountLayout() {
  const pathname = usePathname();
  const { status } = useAuthSession();

  if (status === 'initializing') {
    return (
      <ThemedView style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color="#3c87f7" />
        </View>
      </ThemedView>
    );
  }

  if (status !== 'authenticated') {
    return <Redirect href={`/login?redirectTo=${encodeURIComponent(pathname)}`} />;
  }

  return <Slot />;
}
