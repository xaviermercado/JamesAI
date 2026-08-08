import { describe, expect, it } from 'vitest';

import { hasAdminCapability, isAdministrator } from './admin-permissions';

describe('frontend admin permissions', () => {
  it('keeps ordinary users outside the admin experience', () => {
    expect(isAdministrator('user')).toBe(false);
    expect(hasAdminCapability('user', 'view_insights')).toBe(false);
  });

  it('allows editors to edit but never publish or roll back', () => {
    expect(isAdministrator('editor')).toBe(true);
    expect(hasAdminCapability('editor', 'edit_configuration')).toBe(true);
    expect(hasAdminCapability('editor', 'publish_configuration')).toBe(false);
    expect(hasAdminCapability('editor', 'rollback_configuration')).toBe(false);
  });

  it('allows owners to perform high-impact actions', () => {
    expect(hasAdminCapability('owner', 'publish_configuration')).toBe(true);
    expect(hasAdminCapability('owner', 'view_full_audit')).toBe(true);
  });
});