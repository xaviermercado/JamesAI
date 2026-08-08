import { describe, expect, it } from 'vitest';

import {
  AUTHENTICATED_MENU_ACTIONS,
  ANONYMOUS_MENU_ACTIONS,
  getHeaderMenuActions,
  resolveAccountActionRoute,
  resolveAccountLabel,
  resolveMainMenuTriggerLabel,
  resolveAccountTriggerLabel,
  shouldShowAccountMenu,
  shouldUseCompactAnonymousMenu,
} from './app-header-menu';

describe('app-header-menu logic', () => {
  it('keeps authenticated account menu actions in required order', () => {
    expect(AUTHENTICATED_MENU_ACTIONS.map((item) => item.label)).toEqual([
      'Search',
      'Library',
      'Profile',
      'Log out',
    ]);
  });

  it('uses compact dropdown actions for anonymous users', () => {
    expect(ANONYMOUS_MENU_ACTIONS.map((item) => item.label)).toEqual([
      'Log in',
      'Register',
    ]);
  });

  it('resolves safe account label from display name', () => {
    expect(resolveAccountLabel('ScoutyUser')).toBe('ScoutyUser');
    expect(resolveAccountLabel('  ')).toBe('My account');
    expect(resolveAccountLabel(null)).toBe('My account');
    expect(resolveAccountLabel(undefined)).toBe('My account');
  });

  it('builds accessible trigger labels with expanded state context', () => {
    expect(resolveAccountTriggerLabel(false, 'ScoutyUser')).toBe('Open account menu for ScoutyUser');
    expect(resolveAccountTriggerLabel(true, 'ScoutyUser')).toBe('Close account menu for ScoutyUser');
    expect(resolveMainMenuTriggerLabel(false)).toBe('Open main menu');
    expect(resolveMainMenuTriggerLabel(true)).toBe('Close main menu');
  });

  it('uses canonical routes for account navigation actions', () => {
    expect(resolveAccountActionRoute('search')).toBe('/');
    expect(resolveAccountActionRoute('admin')).toBe('/admin');
    expect(resolveAccountActionRoute('library')).toBe('/profile/library');
    expect(resolveAccountActionRoute('profile')).toBe('/profile');
    expect(resolveAccountActionRoute('about')).toBe('/about');
    expect(resolveAccountActionRoute('contact')).toBe('/contact');
    expect(resolveAccountActionRoute('login')).toBe('/login');
    expect(resolveAccountActionRoute('register')).toBe('/signup');
    expect(resolveAccountActionRoute('logout')).toBeNull();
  });

  it('shows account menu only for authenticated users', () => {
    expect(shouldShowAccountMenu('authenticated')).toBe(true);
    expect(shouldShowAccountMenu('anonymous')).toBe(false);
    expect(shouldShowAccountMenu('initializing')).toBe(false);
  });

  it('keeps anonymous static and first-client renders compact until viewport hydration', () => {
    expect(shouldUseCompactAnonymousMenu(false, false, 1280)).toBe(true);
    expect(shouldUseCompactAnonymousMenu(false, true, 1280)).toBe(false);
    expect(shouldUseCompactAnonymousMenu(false, true, 390)).toBe(true);
    expect(shouldUseCompactAnonymousMenu(true, false, 1280)).toBe(false);
  });

  it('returns the right menu action set by auth status', () => {
    expect(getHeaderMenuActions('authenticated').map((item) => item.key)).toEqual([
      'search',
      'library',
      'profile',
      'logout',
    ]);

    expect(getHeaderMenuActions('anonymous').map((item) => item.key)).toEqual([
      'login',
      'register',
    ]);

    expect(getHeaderMenuActions('initializing').map((item) => item.key)).toEqual([
      'login',
      'register',
    ]);

    expect(getHeaderMenuActions('authenticated', 'editor').map((item) => item.key)).toEqual([
      'search',
      'library',
      'profile',
      'admin',
      'logout',
    ]);
  });
});
