import type { AdminRole } from '../auth/auth-types';

export const ADMIN_CAPABILITIES = [
  'view_insights',
  'view_minimized_feedback',
  'create_configuration',
  'edit_configuration',
  'validate_configuration',
  'preview_configuration',
  'run_sandbox',
  'view_configuration_audit',
  'publish_configuration',
  'rollback_configuration',
  'manage_admin_access',
  'view_full_audit',
] as const;

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

const EDITOR_CAPABILITIES = [
  'view_insights',
  'view_minimized_feedback',
  'create_configuration',
  'edit_configuration',
  'validate_configuration',
  'preview_configuration',
  'run_sandbox',
  'view_configuration_audit',
] as const satisfies readonly AdminCapability[];

export const ADMIN_ROLE_CAPABILITIES: Readonly<Record<AdminRole, readonly AdminCapability[]>> = {
  user: [],
  editor: EDITOR_CAPABILITIES,
  owner: [
    ...EDITOR_CAPABILITIES,
    'publish_configuration',
    'rollback_configuration',
    'manage_admin_access',
    'view_full_audit',
  ],
};

export const HIGH_IMPACT_ADMIN_CAPABILITIES = [
  'publish_configuration',
  'rollback_configuration',
  'manage_admin_access',
] as const satisfies readonly AdminCapability[];

export type ExternalMfaPolicyStatus = 'not_configured';

export interface ExternalMfaPolicy {
  status: ExternalMfaPolicyStatus;
  authorizationEffect: 'none';
}

export const EXTERNAL_MFA_POLICY: Readonly<ExternalMfaPolicy> = Object.freeze({
  status: 'not_configured',
  authorizationEffect: 'none',
});

export function isAdminCapability(value: string): value is AdminCapability {
  return (ADMIN_CAPABILITIES as readonly string[]).includes(value);
}

export function hasAdminCapability(role: AdminRole, capability: AdminCapability): boolean {
  return ADMIN_ROLE_CAPABILITIES[role].includes(capability);
}

export function isHighImpactAdminCapability(capability: AdminCapability): boolean {
  return (HIGH_IMPACT_ADMIN_CAPABILITIES as readonly AdminCapability[]).includes(capability);
}