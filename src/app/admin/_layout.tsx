import { Redirect, Slot, usePathname } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AdminShell } from '@/components/admin/admin-shell';
import { isAdministrator } from '@/components/admin/admin-permissions';
import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedView } from '@/components/themed-view';
import { BrandColors } from '@/constants/theme';

export default function AdminLayout() {
  const pathname = usePathname();
  const { status, user } = useAuthSession();

  if (status === 'initializing') {
    return <ThemedView style={{ flex: 1 }}><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={BrandColors.scoutyBlue} /></View></ThemedView>;
  }

  if (status !== 'authenticated') {
    return <Redirect href={`/login?redirectTo=${encodeURIComponent(pathname)}`} />;
  }

  if (!user || user.accountStatus !== 'active' || !isAdministrator(user.adminRole)) {
    return <Redirect href="/" />;
  }

  return <AdminShell><Slot /></AdminShell>;
}