import { useEffect, useEffectEvent, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AdminPage } from '@/components/admin/admin-shell';
import { confirmAdminAction } from '@/components/admin/admin-confirmation';
import { formatPercent, formatSigned, utcDateDaysAgo } from '@/components/admin/admin-helpers';
import { AdminButton, AdminField, AdminSection, StatusMessage, adminRowStyle } from '@/components/admin/admin-ui';
import { hasAdminCapability } from '@/components/admin/admin-permissions';
import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedText } from '@/components/themed-text';
import { BrandColors, Radii, Spacing } from '@/constants/theme';
import { compareConfigurationVersions, listConfigurations, rollbackConfiguration } from '@/services/admin-api';
import type { StoredConfiguration, VersionComparisonDto } from '@/types/admin';

export default function AdminVersionsScreen() {
  const { user, csrfToken } = useAuthSession();
  const [versions, setVersions] = useState<StoredConfiguration[]>([]);
  const [baselineVersionId, setBaselineVersionId] = useState('');
  const [comparisonVersionId, setComparisonVersionId] = useState('');
  const [startDate, setStartDate] = useState(() => utcDateDaysAgo(89));
  const [endDate, setEndDate] = useState(() => utcDateDaysAgo(0));
  const [comparison, setComparison] = useState<VersionComparisonDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canRollback = hasAdminCapability(user?.adminRole, 'rollback_configuration');

  const loadVersions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listConfigurations();
      setVersions(response.items);
      const published = response.items.filter((item) => item.status !== 'draft');
      setBaselineVersionId((current) => current || published[1]?.configurationId || published[0]?.configurationId || '');
      setComparisonVersionId((current) => current || published[0]?.configurationId || '');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load configuration versions.');
    } finally {
      setLoading(false);
    }
  };

  const loadInitial = useEffectEvent(loadVersions);
  useEffect(() => {
    const timeoutId = setTimeout(() => { void loadInitial(); }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  const compare = async () => {
    if (!baselineVersionId || !comparisonVersionId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setComparison(await compareConfigurationVersions({ startDate, endDate, baselineVersionId, comparisonVersionId }));
      setMessage('Version comparison updated.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to compare versions.');
    } finally {
      setBusy(false);
    }
  };

  const rollback = async (version: StoredConfiguration) => {
    if (!canRollback || !csrfToken) return;
    const confirmed = await confirmAdminAction('Roll back configuration?', `Version ${version.versionNumber} will be copied into a new published version. This does not erase history.`);
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await rollbackConfiguration(version.configurationId, `Rollback to version ${version.versionNumber}`, csrfToken);
      setMessage(`Rolled back to version ${version.versionNumber}.`);
      await loadVersions();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to roll back this version.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage title="Versions" description="Inspect configuration history and compare observed aggregate outcomes without implying causation.">
      <StatusMessage message={error} tone="error" />
      <StatusMessage message={message} tone="success" />
      <AdminSection title="Compare observed windows" description="IDs accept the stable configuration identifiers shown in history below.">
        <View style={adminRowStyle}>
          <AdminField label="Baseline version ID" value={baselineVersionId} onChangeText={setBaselineVersionId} />
          <AdminField label="Comparison version ID" value={comparisonVersionId} onChangeText={setComparisonVersionId} />
          <AdminField label="Start date" value={startDate} onChangeText={setStartDate} />
          <AdminField label="End date" value={endDate} onChangeText={setEndDate} />
          <AdminButton label="Compare" onPress={() => void compare()} disabled={busy || !baselineVersionId || !comparisonVersionId} />
        </View>
        {comparison ? (
          <View style={styles.comparison}>
            {comparison.warnings.map((warning) => <StatusMessage key={warning.code} message={warning.message} />)}
            <View style={styles.deltaGrid}>
              {[
                ['Requests', formatSigned(comparison.absoluteDeltas.recommendationRequests)],
                ['Successful', formatSigned(comparison.absoluteDeltas.successfulRecommendations)],
                ['Failures', formatSigned(comparison.absoluteDeltas.recommendationFailures)],
                ['Helpful', formatSigned(comparison.absoluteDeltas.helpfulRecommendations)],
                ['Success rate', formatSigned(comparison.absoluteDeltas.successRate, true)],
                ['Failure rate', formatSigned(comparison.absoluteDeltas.failureRate, true)],
              ].map(([label, value]) => <View key={label} style={styles.delta}><ThemedText themeColor="textSecondary">{label}</ThemedText><ThemedText type="smallBold">{value}</ThemedText></View>)}
            </View>
            <ThemedText themeColor="textSecondary">Baseline: {comparison.baseline.overview.counts.recommendationRequests} requests, {formatPercent(comparison.baseline.overview.rates.successfulRecommendations.rate)} success. Comparison: {comparison.comparison.overview.counts.recommendationRequests} requests, {formatPercent(comparison.comparison.overview.rates.successfulRecommendations.rate)} success.</ThemedText>
          </View>
        ) : null}
      </AdminSection>
      <AdminSection title="Configuration history">
        {loading ? <ActivityIndicator accessibilityLabel="Loading versions" color={BrandColors.scoutyBlue} /> : null}
        <View style={styles.history}>
          {versions.map((version) => (
            <View key={version.configurationId} style={styles.versionRow}>
              <View style={styles.versionSummary}>
                <ThemedText type="smallBold">Version {version.versionNumber} · {version.status}</ThemedText>
                <ThemedText themeColor="textSecondary">{version.validationStatus} · row {version.rowVersion} · updated {new Date(version.updatedAt).toLocaleString()}</ThemedText>
                <ThemedText style={styles.idText}>{version.configurationId}</ThemedText>
              </View>
              {canRollback && version.status !== 'draft' ? <AdminButton label={`Roll back to v${version.versionNumber}`} tone="danger" onPress={() => void rollback(version)} disabled={busy} /> : null}
            </View>
          ))}
          {!loading && versions.length === 0 ? <ThemedText themeColor="textSecondary">No configuration versions are available.</ThemedText> : null}
        </View>
      </AdminSection>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  comparison: { gap: Spacing.three },
  deltaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  delta: { flexBasis: 150, flexGrow: 1, padding: Spacing.three, borderRadius: Radii.small, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  history: { gap: 0, borderTopWidth: 1, borderTopColor: BrandColors.border },
  versionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three, paddingVertical: Spacing.three, borderBottomWidth: 1, borderBottomColor: BrandColors.border },
  versionSummary: { flex: 1, minWidth: 240, gap: Spacing.one },
  idText: { fontSize: 12 },
});