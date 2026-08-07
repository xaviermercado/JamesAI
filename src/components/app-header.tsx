import { Link, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { PUBLIC_BRAND_NAME, scoutyHeroMascot } from '@/constants/brand';
import { getScoutyAvatarAsset } from '@/constants/scouty-avatar-assets';
import { resolveAvatarId, SCOUTY_DEFAULT_AVATAR_ID, type ScoutyAvatarId } from '@/constants/scouty-avatar-catalog';
import { BrandColors, Fonts, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useAuthSession } from '@/components/auth-session-provider';
import {
  getHeaderMenuActions,
  resolveAccountActionRoute,
  resolveAccountLabel,
  resolveMainMenuTriggerLabel,
  resolveAccountTriggerLabel,
  shouldShowAccountMenu,
  type AccountAction,
} from '@/components/app-header-menu';
import { ThemedText } from '@/components/themed-text';
import { logoutAuthAccount } from '@/services/auth-api';
import { getMyProfile } from '@/services/profile-api';

const ACCOUNT_MENU_ID = 'scouty-account-menu';
const ACCOUNT_MENU_WIDTH = 248;

export function AppHeader() {
  const router = useRouter();
  const { status, csrfToken, clearSession } = useAuthSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountLabel, setAccountLabel] = useState('My account');
  const [avatarId, setAvatarId] = useState<ScoutyAvatarId>(SCOUTY_DEFAULT_AVATAR_ID);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number }>({ top: 70, right: 16 });
  const triggerRef = useRef<View | null>(null);
  const menuPanelRef = useRef<View | null>(null);
  const menuItemRefs = useRef<(View | null)[]>([]);
  const showAccountMenu = shouldShowAccountMenu(status);
  const menuActions = useMemo(() => getHeaderMenuActions(status), [status]);

  const triggerA11yLabel = useMemo(
    () => (showAccountMenu ? resolveAccountTriggerLabel(menuOpen, accountLabel) : resolveMainMenuTriggerLabel(menuOpen)),
    [accountLabel, menuOpen, showAccountMenu],
  );

  useEffect(() => {
    let active = true;

    if (status !== 'authenticated') {
      return () => {
        active = false;
      };
    }

    const loadAccountIdentity = async () => {
      try {
        const response = await getMyProfile();
        if (!active) return;
        const profile = response.profile;
        setAccountLabel(resolveAccountLabel(profile?.displayName));
        setAvatarId(resolveAvatarId(profile?.avatarId));
        setAvatarFailed(false);
      } catch {
        if (!active) return;
        setAccountLabel(resolveAccountLabel(null));
        setAvatarId(SCOUTY_DEFAULT_AVATAR_ID);
      }
    };

    void loadAccountIdentity();
    return () => {
      active = false;
    };
  }, [status]);

  const closeMenu = (restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) {
      const triggerNode = triggerRef.current as unknown as { focus?: () => void };
      setTimeout(() => triggerNode?.focus?.(), 0);
    }
  };

  const updateMenuPosition = () => {
    const triggerNode = triggerRef.current as unknown as {
      measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
    };

    if (!triggerNode?.measureInWindow) {
      return;
    }

    triggerNode.measureInWindow((x, y, width, height) => {
      const viewportWidth = Dimensions.get('window').width;
      const right = Math.max(8, viewportWidth - (x + width));
      const top = Math.max(8, y + height + 8);
      setMenuPosition({ top, right });
    });
  };

  const onTriggerPress = () => {
    setMenuError(null);
    if (menuOpen) {
      closeMenu();
      return;
    }

    updateMenuPosition();
    setMenuOpen(true);
  };

  const focusMenuItem = (index: number) => {
    const node = menuItemRefs.current[index] as unknown as { focus?: () => void };
    node?.focus?.();
  };

  useEffect(() => {
    if (!menuOpen) return;
    const timer = setTimeout(() => focusMenuItem(0), 0);
    return () => clearTimeout(timer);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const onResize = () => {
      updateMenuPosition();
    };

    const subscription = Dimensions.addEventListener('change', onResize);
    return () => {
      subscription.remove();
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || typeof document === 'undefined') {
      return undefined;
    }

    const handleFocusIn = (event: FocusEvent) => {
      const targetNode = event.target as Node | null;
      const triggerNode = triggerRef.current as unknown as { contains?: (node: Node) => boolean };
      const panelNode = menuPanelRef.current as unknown as { contains?: (node: Node) => boolean };

      if (!targetNode) {
        closeMenu();
        return;
      }

      if (triggerNode?.contains?.(targetNode) || panelNode?.contains?.(targetNode)) {
        return;
      }

      closeMenu();
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || typeof document === 'undefined') {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(true);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const onActionPress = async (action: AccountAction) => {
    setMenuError(null);

    if (action !== 'logout') {
      closeMenu();
      const route = resolveAccountActionRoute(action);
      if (route) {
        router.push(route as never);
      }
      return;
    }

    if (!csrfToken || logoutBusy) {
      return;
    }

    setLogoutBusy(true);
    try {
      await logoutAuthAccount(csrfToken);
      clearSession();
      closeMenu();
      router.replace('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign out right now.';
      setMenuError(message);
    } finally {
      setLogoutBusy(false);
    }
  };

  const triggerAriaProps = {
    'aria-expanded': menuOpen,
    'aria-controls': ACCOUNT_MENU_ID,
    'aria-haspopup': 'menu',
  } as unknown as object;

  const menuStyle: ViewStyle = {
    top: menuPosition.top,
    right: menuPosition.right,
  };

  return (
    <View style={styles.headerWrap}>
      <View style={styles.headerInner}>
        <Link href={'/' as never} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={`${PUBLIC_BRAND_NAME} home`} style={styles.brandLink}>
            <Image source={scoutyHeroMascot} style={styles.brandMark} contentFit="contain" accessibilityLabel="Scouty mascot" />
            <ThemedText style={styles.brandText}>{PUBLIC_BRAND_NAME}</ThemedText>
          </Pressable>
        </Link>

        <View style={styles.actionsRow}>
          <Pressable
            ref={triggerRef}
            accessibilityRole="button"
            accessibilityLabel={triggerA11yLabel}
            accessibilityState={{ expanded: menuOpen }}
            onPress={onTriggerPress}
            style={[styles.accountTrigger, !showAccountMenu && styles.mainMenuTrigger]}
            testID="account-menu-trigger"
            {...triggerAriaProps}
          >
            {showAccountMenu ? (
              <>
                <Image
                  source={getScoutyAvatarAsset(avatarFailed ? SCOUTY_DEFAULT_AVATAR_ID : resolveAvatarId(avatarId))}
                  style={styles.accountAvatar}
                  contentFit="contain"
                  onError={() => setAvatarFailed(true)}
                  accessible={false}
                  accessibilityLabel=""
                  testID="account-menu-avatar"
                />
                <ThemedText numberOfLines={1} ellipsizeMode="tail" style={styles.accountLabel}>{accountLabel}</ThemedText>
              </>
            ) : (
              <>
                <View style={styles.menuIcon} accessible={false}>
                  <View style={styles.menuIconLine} />
                  <View style={styles.menuIconLine} />
                  <View style={styles.menuIconLine} />
                </View>
                <ThemedText style={styles.accountLabel}>Menu</ThemedText>
              </>
            )}
            <ThemedText style={styles.accountChevron}>{menuOpen ? '▲' : '▼'}</ThemedText>
          </Pressable>
        </View>
      </View>

      <Modal transparent visible={menuOpen} animationType="none" onRequestClose={() => closeMenu(true)}>
        <View style={styles.menuOverlayRoot}>
          <Pressable testID="account-menu-backdrop" accessibilityRole="button" accessibilityLabel="Close account menu" onPress={() => closeMenu()} style={styles.menuBackdrop} />

          <View
            ref={menuPanelRef}
            nativeID={ACCOUNT_MENU_ID}
            testID="account-menu-panel"
            style={[styles.accountMenuPanel, menuStyle]}
          >
            {menuActions.map((action, index) => {
              const logoutAction = action.key === 'logout';
              return (
                <Pressable
                  key={action.key}
                  ref={(node) => {
                    menuItemRefs.current[index] = node;
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  style={[styles.menuItemButton, logoutAction && styles.menuItemButtonLogout]}
                  onPress={() => void onActionPress(action.key)}
                  disabled={logoutAction && (logoutBusy || !showAccountMenu)}
                >
                  <ThemedText style={[styles.menuItemText, logoutAction && styles.menuItemTextLogout]}>
                    {logoutAction && logoutBusy ? 'Logging out...' : action.label}
                  </ThemedText>
                </Pressable>
              );
            })}
            {menuError ? <ThemedText style={styles.menuErrorText}>{menuError}</ThemedText> : null}
          </View>
        </View>
      </Modal>
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
    flexShrink: 1,
    minWidth: 0,
  },
  brandMark: {
    width: 42,
    height: 42,
  },
  brandText: {
    color: BrandColors.surface,
    fontFamily: Fonts.display,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    flexShrink: 1,
    minWidth: 0,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 0,
    flexShrink: 1,
  },
  accountTrigger: {
    minHeight: 44,
    maxWidth: 220,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: Spacing.two,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  mainMenuTrigger: {
    maxWidth: 170,
  },
  menuIcon: {
    width: 18,
    gap: 3,
    flexShrink: 0,
  },
  menuIconLine: {
    height: 2,
    borderRadius: 999,
    backgroundColor: BrandColors.surface,
  },
  accountAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e7efff',
    flexShrink: 0,
  },
  accountLabel: {
    color: BrandColors.surface,
    fontWeight: '700',
    flexShrink: 1,
    minWidth: 0,
  },
  accountChevron: {
    color: BrandColors.surface,
    fontSize: 11,
    flexShrink: 0,
  },
  menuOverlayRoot: {
    flex: 1,
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  accountMenuPanel: {
    position: 'absolute',
    width: ACCOUNT_MENU_WIDTH,
    maxWidth: '92%',
    borderRadius: Radii.large,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: '#ffffff',
    padding: Spacing.two,
    gap: Spacing.one,
    shadowColor: '#0f172a',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 10,
  },
  menuItemButton: {
    minHeight: 44,
    borderRadius: Radii.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  menuItemButtonLogout: {
    borderTopWidth: 1,
    borderTopColor: '#dfe6f3',
    marginTop: Spacing.one,
    paddingTop: Spacing.two,
  },
  menuItemText: {
    color: BrandColors.midnight900,
    fontWeight: '700',
  },
  menuItemTextLogout: {
    color: '#a21020',
  },
  menuErrorText: {
    color: '#b42318',
    fontSize: 12,
    paddingHorizontal: Spacing.two,
    paddingTop: 4,
  },
});