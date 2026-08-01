import { Tabs, TabSlot } from 'expo-router/ui';
import { StyleSheet, View } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <View style={styles.tabListContainer} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    height: 0,
    pointerEvents: 'none',
  },
  innerContainer: {
    maxWidth: MaxContentWidth,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
});
