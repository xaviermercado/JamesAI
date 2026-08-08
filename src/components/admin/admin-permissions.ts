import type { AdminCapability, AdminRole } from '@/types/admin';

const EDITOR_CAPABILITIES: readonly AdminCapability[] = [
  'view_insights',
  'view_minimized_feedback',
  'create_configuration',
  'edit_configuration',
  'validate_configuration',
  'preview_configuration',
  'run_sandbox',
  'view_configuration_audit',
];

const ROLE_CAPABILITIES: Readonly<Record<AdminRole, readonly AdminCapability[]>> = {
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

export function hasAdminCapability(role: AdminRole | null | undefined, capability: AdminCapability): boolean {
  return role ? ROLE_CAPABILITIES[role].includes(capability) : false;
}

export function isAdministrator(role: AdminRole | null | undefined): role is 'editor' | 'owner' {
  return role === 'editor' || role === 'owner';
}