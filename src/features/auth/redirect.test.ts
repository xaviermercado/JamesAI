import { describe, expect, it } from 'vitest';

import { getSafeRedirectPath } from './redirect';

describe('getSafeRedirectPath', () => {
  it('allows protected local account paths', () => {
    expect(getSafeRedirectPath('/profile/edit')).toBe('/profile/edit');
  });

  it('rejects auth loop targets and external values', () => {
    expect(getSafeRedirectPath('/login')).toBeNull();
    expect(getSafeRedirectPath('https://evil.example')).toBeNull();
    expect(getSafeRedirectPath('//evil.example')).toBeNull();
  });
});