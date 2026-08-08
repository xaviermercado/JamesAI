import { useEffect, useEffectEvent, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AdminPage } from '@/components/admin/admin-shell';
import { confirmAdminAction } from '@/components/admin/admin-confirmation';
import { hasAdminCapability } from '@/components/admin/admin-permissions';
import { AdminButton, AdminField, AdminSection, ChoiceGroup, StatusMessage, adminRowStyle } from '@/components/admin/admin-ui';
import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedText } from '@/components/themed-text';
import { BrandColors, Spacing } from '@/constants/theme';
import { listAdminAccessCandidates, listAuditLog, updateAdminAccess } from '@/services/admin-api';
import type { AdminAccessItemDto, AdminRole, AuditLogItemDto } from '@/types/admin';

export default function AdminAuditScreen() {
  const { user, csrfToken } = useAuthSession();
  const canView = hasAdminCapability(user?.adminRole, 'view_configuration_audit');
  const canViewFull = hasAdminCapability(user?.adminRole, 'view_full_audit');
  const canManageAccess = hasAdminCapability(user?.adminRole, 'manage_admin_access');
  const [action, setAction] = useState('');
  const [outcome, setOutcome] = useState<'all' | 'succeeded' | 'failed' | 'denied'>('all');
  const [items, setItems] = useState<AuditLogItemDto[]>([]);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState<string | null>(null);
  const [accessItems, setAccessItems] = useState<AdminAccessItemDto[]>([]);
  const [accessRoles, setAccessRoles] = useState<Record<string, AdminRole>>({});
  const [accessLoading, setAccessLoading] = useState(canManageAccess);
  const [accessStatus, setAccessStatus] = useState<string | null>(null);

  const load = async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const page = await listAuditLog({ action: action || undefined, outcome: outcome === 'all' ? undefined : outcome, pageSize: 50 });
      setItems(page.items);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load the audit log.');
    } finally {
      setLoading(false);
    }
  };

  const loadInitial = useEffectEvent(load);
  useEffect(() => {
    const timeoutId = setTimeout(() => { void loadInitial(); }, 0);
    return () => clearTimeout(timeoutId);
  }, [canView]);

  const loadAccess = async () => {
    if (!canManageAccess) return;
    setAccessLoading(true);
    setAccessStatus(null);
    try {
      const response = await listAdminAccessCandidates();
      setAccessItems(response.items);
      setAccessRoles(Object.fromEntries(response.items.map((item) => [item.userId, item.adminRole])));
    } catch (nextError) {
      setAccessStatus(nextError instanceof Error ? nextError.message : 'Unable to load administrator access.');
    } finally {
      setAccessLoading(false);
    }
  };

  const loadAccessInitial = useEffectEvent(loadAccess);
  useEffect(() => {
    const timeoutId = setTimeout(() => { void loadAccessInitial(); }, 0);
    return () => clearTimeout(timeoutId);
  }, [canManageAccess]);

  const saveAccess = async (item: AdminAccessItemDto) => {
    const role = accessRoles[item.userId] ?? item.adminRole;
    if (role === item.adminRole || !csrfToken) return;
    const confirmed = await confirmAdminAction(
      'Change administrator access?',
      `${item.email} will become ${role}. Their active sessions will be signed out.`,
    );
    if (!confirmed) return;
    setAccessLoading(true);
    setAccessStatus(null);
    try {
      const result = await updateAdminAccess(item.userId, role, csrfToken);
      setAccessItems((current) => current.map((candidate) => candidate.userId === item.userId ? result.item : candidate));
      setAccessStatus(`Access updated for ${item.email}. ${result.revokedSessions} active session${result.revokedSessions === 1 ? '' : 's'} signed out.`);
    } catch (nextError) {
      setAccessStatus(nextError instanceof Error ? nextError.message : 'Unable to update administrator access.');
    } finally {
      setAccessLoading(false);
    }
  };

  if (!canView) {
    return <AdminPage title="Audit" description="Administrative activity is capability-gated."><StatusMessage tone="error" message="Your account cannot view configuration audit activity." /></AdminPage>;
  }

  return (
    <AdminPage title="Audit" description={canViewFull ? 'Full administrative audit access.' : 'Configuration audit access. Owner-only activity may be omitted by the server.'}>
      <AdminSection title="Audit filters">
        <View style={adminRowStyle}>
          <AdminField label="Action" value={action} onChangeText={setAction} hint="Leave blank for all permitted actions." />
          <ChoiceGroup label="Outcome" value={outcome} options={[{ value: 'all', label: 'All' }, { value: 'succeeded', label: 'Succeeded' }, { value: 'failed', label: 'Failed' }, { value: 'denied', label: 'Denied' }]} onChange={setOutcome} />
          <AdminButton label="Apply filters" onPress={() => void load()} disabled={loading} />
        </View>
      </AdminSection>
      <StatusMessage message={error} tone="error" />
      <AdminSection title="Activity">
        {loading ? <ActivityIndicator accessibilityLabel="Loading audit activity" color={BrandColors.scoutyBlue} /> : null}
        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.auditId} style={styles.row}>
              <ThemedText type="smallBold">{item.action.replaceAll('_', ' ')} · {item.outcome}</ThemedText>
              <ThemedText themeColor="textSecondary">{new Date(item.occurredAt).toLocaleString()} · {item.targetType}{item.targetId ? ` ${item.targetId}` : ''}</ThemedText>
              <ThemedText style={styles.summary}>{Object.entries(item.summary).map(([key, value]) => `${key}: ${String(value)}`).join(' · ') || 'No additional summary'}</ThemedText>
            </View>
          ))}
          {!loading && items.length === 0 ? <ThemedText themeColor="textSecondary">No permitted audit activity matches these filters.</ThemedText> : null}
        </View>
      </AdminSection>
      {canManageAccess ? (
        <AdminSection title="Administrator access" description="Owner-only. Grant the minimum role needed. Role changes sign out the affected account and are recorded in the audit log.">
          <StatusMessage message={accessStatus} tone={accessStatus?.startsWith('Access updated') ? 'success' : 'error'} />
          {accessLoading ? <ActivityIndicator accessibilityLabel="Loading administrator access" color={BrandColors.scoutyBlue} /> : null}
          <View style={styles.list}>
            {accessItems.map((item) => (
              <View key={item.userId} style={styles.accessRow}>
                <View style={styles.accessIdentity}>
                  <ThemedText type="smallBold">{item.email}</ThemedText>
                  <ThemedText themeColor="textSecondary">Current role: {item.adminRole}</ThemedText>
                </View>
                <ChoiceGroup
                  label={`Role for ${item.email}`}
                  value={accessRoles[item.userId] ?? item.adminRole}
                  options={[{ value: 'user', label: 'User' }, { value: 'editor', label: 'Editor' }, { value: 'owner', label: 'Owner' }] as const}
                  onChange={(role) => setAccessRoles((current) => ({ ...current, [item.userId]: role }))}
                />
                <AdminButton
                  label="Save access"
                  tone="danger"
                  disabled={accessLoading || (accessRoles[item.userId] ?? item.adminRole) === item.adminRole}
                  onPress={() => void saveAccess(item)}
                />
              </View>
            ))}
            {!accessLoading && accessItems.length === 0 ? <ThemedText themeColor="textSecondary">No active accounts are available.</ThemedText> : null}
          </View>
        </AdminSection>
      ) : null}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  list: { borderTopWidth: 1, borderTopColor: BrandColors.border },
  row: { paddingVertical: Spacing.three, gap: Spacing.one, borderBottomWidth: 1, borderBottomColor: BrandColors.border },
  summary: { fontSize: 13 },
  accessRow: { paddingVertical: Spacing.three, gap: Spacing.two, borderBottomWidth: 1, borderBottomColor: BrandColors.border },
  accessIdentity: { gap: Spacing.one },
});