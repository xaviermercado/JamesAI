export type HeaderAuthStatus = 'initializing' | 'authenticated' | 'anonymous';
export type AccountAction =
  | 'search'
  | 'library'
  | 'profile'
  | 'about'
  | 'contact'
  | 'login'
  | 'register'
  | 'logout';

export interface HeaderMenuItem {
  key: AccountAction;
  label: string;
}

export const AUTHENTICATED_MENU_ACTIONS: HeaderMenuItem[] = [
  { key: 'search', label: 'Search' },
  { key: 'library', label: 'Library' },
  { key: 'profile', label: 'Profile' },
  { key: 'logout', label: 'Log out' },
];

export const ANONYMOUS_MENU_ACTIONS: HeaderMenuItem[] = [
  { key: 'login', label: 'Log in' },
  { key: 'register', label: 'Register' },
];

export function resolveAccountLabel(displayName: string | null | undefined): string {
  const normalized = (displayName ?? '').trim();
  return normalized.length > 0 ? normalized : 'My account';
}

export function resolveAccountTriggerLabel(menuOpen: boolean, accountLabel: string): string {
  return `${menuOpen ? 'Close' : 'Open'} account menu for ${accountLabel}`;
}

export function resolveMainMenuTriggerLabel(menuOpen: boolean): string {
  return menuOpen ? 'Close main menu' : 'Open main menu';
}

export function resolveAccountActionRoute(action: AccountAction): string | null {
  if (action === 'search') return '/';
  if (action === 'library') return '/profile/library';
  if (action === 'profile') return '/profile';
  if (action === 'about') return '/about';
  if (action === 'contact') return '/contact';
  if (action === 'login') return '/login';
  if (action === 'register') return '/signup';
  return null;
}

export function shouldShowAccountMenu(status: HeaderAuthStatus): boolean {
  return status === 'authenticated';
}

export function getHeaderMenuActions(status: HeaderAuthStatus): HeaderMenuItem[] {
  return status === 'authenticated' ? AUTHENTICATED_MENU_ACTIONS : ANONYMOUS_MENU_ACTIONS;
}
