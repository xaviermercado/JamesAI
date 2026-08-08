import { describe, expect, it } from 'vitest';

import {
  ADMIN_ROLE_CAPABILITIES,
  EXTERNAL_MFA_POLICY,
  hasAdminCapability,
  isAdminCapability,
  isHighImpactAdminCapability,
} from './admin-permissions';

describe('admin permissions', () => {
  it('denies every admin capability to ordinary users', () => {
    expect(ADMIN_ROLE_CAPABILITIES.user).toEqual([]);
    expect(hasAdminCapability('user', 'view_insights')).toBe(false);
  });

  it('grants editors operational capabilities but not owner capabilities', () => {
    expect(hasAdminCapability('editor', 'view_insights')).toBe(true);
    expect(hasAdminCapability('editor', 'view_minimized_feedback')).toBe(true);
    expect(hasAdminCapability('editor', 'create_configuration')).toBe(true);
    expect(hasAdminCapability('editor', 'edit_configuration')).toBe(true);
    expect(hasAdminCapability('editor', 'validate_configuration')).toBe(true);
    expect(hasAdminCapability('editor', 'preview_configuration')).toBe(true);
    expect(hasAdminCapability('editor', 'run_sandbox')).toBe(true);
    expect(hasAdminCapability('editor', 'view_configuration_audit')).toBe(true);
    expect(hasAdminCapability('editor', 'publish_configuration')).toBe(false);
    expect(hasAdminCapability('editor', 'rollback_configuration')).toBe(false);
    expect(hasAdminCapability('editor', 'manage_admin_access')).toBe(false);
    expect(hasAdminCapability('editor', 'view_full_audit')).toBe(false);
  });

  it('grants owners the complete capability set', () => {
    expect(ADMIN_ROLE_CAPABILITIES.owner).toHaveLength(12);
    expect(hasAdminCapability('owner', 'publish_configuration')).toBe(true);
    expect(hasAdminCapability('owner', 'rollback_configuration')).toBe(true);
    expect(hasAdminCapability('owner', 'manage_admin_access')).toBe(true);
    expect(hasAdminCapability('owner', 'view_full_audit')).toBe(true);
  });

  it('validates capability names and identifies high-impact actions', () => {
    expect(isAdminCapability('view_insights')).toBe(true);
    expect(isAdminCapability('unknown')).toBe(false);
    expect(isHighImpactAdminCapability('publish_configuration')).toBe(true);
    expect(isHighImpactAdminCapability('view_full_audit')).toBe(false);
  });

  it('records that external MFA is not configured and has no authorization effect', () => {
    expect(EXTERNAL_MFA_POLICY).toEqual({ status: 'not_configured', authorizationEffect: 'none' });
  });
});