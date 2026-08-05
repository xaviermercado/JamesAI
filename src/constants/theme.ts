/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#172033',
    background: '#F5F7FF',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E8F0FF',
    textSecondary: '#667085',
  },
  dark: {
    text: '#172033',
    background: '#F5F7FF',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E8F0FF',
    textSecondary: '#667085',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    display: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    display: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-body)',
    display: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BrandColors = {
  midnight950: '#07152F',
  midnight900: '#0B1633',
  midnight800: '#123A78',
  scoutyBlue: '#3478F6',
  scoutyCyan: '#45C8F5',
  scoutyCoral: '#FF5D5D',
  canvas: '#F5F7FF',
  surface: '#FFFFFF',
  ink: '#172033',
  muted: '#667085',
  border: 'rgba(23, 32, 51, 0.10)',
} as const;

export const Radii = {
  small: 10,
  medium: 16,
  large: 22,
  hero: 30,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 1480;
