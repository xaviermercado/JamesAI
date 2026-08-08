import { useEffect, useEffectEvent, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AdminPage } from '@/components/admin/admin-shell';
import { AdminButton, AdminField, AdminSection, StatusMessage, adminGridStyle, adminRowStyle } from '@/components/admin/admin-ui';
import { formatPercent, utcDateDaysAgo } from '@/components/admin/admin-helpers';
import { ThemedText } from '@/components/themed-text';
import { BrandColors, Radii, Spacing } from '@/constants/theme';
import { getAnalyticsOverview } from '@/services/admin-api';
import type { AnalyticsOverviewDto } from '@/types/admin';

export default function AdminOverviewScreen() {
  const [startDate, setStartDate] = useState(() => utcDateDaysAgo(29));
  const [endDate, setEndDate] = useState(() => utcDateDaysAgo(0));
  const [overview, setOverview] = useState<AnalyticsOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await getAnalyticsOverview({ startDate, endDate }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load the admin overview.');
    } finally {
      setLoading(false);
    }
  };

  const loadInitial = useEffectEvent(load);
  useEffect(() => {
    const timeoutId = setTimeout(() => { void loadInitial(); }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  const metrics = overview ? [
    ['Recommendation requests', String(overview.counts.recommendationRequests)],
    ['Successful recommendations', formatPercent(overview.rates.successfulRecommendations.rate)],
    ['Empty results', formatPercent(overview.rates.emptyResults.rate)],
    ['Recommendation failures', formatPercent(overview.rates.recommendationFailures.rate)],
    ['Helpful recommendations', formatPercent(overview.rates.helpfulRecommendations.rate)],
    ['Saves', formatPercent(overview.rates.saves.rate)],
  ] : [];

  return (
    <AdminPage title="Overview" description="Operational health and privacy-safe product trends for the selected UTC date range.">
      <AdminSection title="Date range">
        <View style={adminRowStyle}>
          <AdminField label="Start date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
          <AdminField label="End date" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
          <AdminButton label="Refresh" onPress={() => void load()} disabled={loading} />
        </View>
      </AdminSection>
      <StatusMessage message={error} tone="error" />
      {loading ? <ActivityIndicator accessibilityLabel="Loading overview" color={BrandColors.scoutyBlue} /> : null}
      {overview ? (
        <>
          <AdminSection title="System health" description="Threshold status is computed by the server from aggregate rates and latency buckets.">
            <View style={[styles.health, styles[`health_${overview.systemHealth.status}`]]}>
              <ThemedText type="smallBold">Overall: {overview.systemHealth.status}</ThemedText>
              <ThemedText>Failure rate: {formatPercent(overview.systemHealth.recommendationFailures.rate)} ({overview.systemHealth.recommendationFailures.status})</ThemedText>
              <ThemedText>Empty-result rate: {formatPercent(overview.systemHealth.emptyResults.rate)} ({overview.systemHealth.emptyResults.status})</ThemedText>
              <ThemedText>P95 response bucket: {overview.systemHealth.responseLatency.p95Bucket ?? 'No data'} ({overview.systemHealth.responseLatency.status})</ThemedText>
            </View>
          </AdminSection>
          <AdminSection title="Recommendation summary">
            <View style={adminGridStyle}>
              {metrics.map(([label, value]) => (
                <View key={label} style={styles.metric}>
                  <ThemedText themeColor="textSecondary" style={styles.metricLabel}>{label}</ThemedText>
                  <ThemedText type="subtitle" style={styles.metricValue}>{value}</ThemedText>
                </View>
              ))}
            </View>
          </AdminSection>
          <AdminSection title="Supporting activity">
            <View style={styles.table} {...({ role: 'table' } as unknown as object)}>
              {[
                ['Registrations', overview.counts.registrations, 'Completed registrations'],
                ['Feedback', overview.counts.feedback.positive + overview.counts.feedback.negative + overview.counts.feedback.alreadyWatched, `${overview.counts.feedback.positive} positive, ${overview.counts.feedback.negative} negative, ${overview.counts.feedback.alreadyWatched} already watched`],
                ['Letterboxd sync', overview.counts.letterboxdSync.succeeded + overview.counts.letterboxdSync.failed, `${overview.counts.letterboxdSync.succeeded} succeeded, ${overview.counts.letterboxdSync.failed} failed`],
                ['Verification email', overview.counts.verificationEmail.succeeded + overview.counts.verificationEmail.failed, `${overview.counts.verificationEmail.succeeded} succeeded, ${overview.counts.verificationEmail.failed} failed`],
                ['Contact submissions', overview.counts.contactSubmissions.succeeded + overview.counts.contactSubmissions.failed, `${overview.counts.contactSubmissions.succeeded} succeeded, ${overview.counts.contactSubmissions.failed} failed`],
              ].map(([label, total, detail]) => (
                <View key={String(label)} style={styles.tableRow} {...({ role: 'row' } as unknown as object)}>
                  <ThemedText type="smallBold" style={styles.tableName}>{label}</ThemedText>
                  <ThemedText style={styles.tableTotal}>{total}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.tableDetail}>{detail}</ThemedText>
                </View>
              ))}
            </View>
          </AdminSection>
        </>
      ) : null}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  health: { padding: Spacing.three, borderRadius: Radii.small, borderLeftWidth: 5, gap: Spacing.one, backgroundColor: '#edf9f3' },
  health_healthy: { borderLeftColor: '#147d52' },
  health_warning: { borderLeftColor: '#b7791f', backgroundColor: '#fff8e6' },
  health_critical: { borderLeftColor: '#b42318', backgroundColor: '#fff1f0' },
  metric: { flexGrow: 1, flexBasis: 210, minWidth: 0, paddingVertical: Spacing.three, paddingHorizontal: Spacing.three, borderLeftWidth: 3, borderLeftColor: BrandColors.scoutyBlue, backgroundColor: BrandColors.surface },
  metricLabel: { fontSize: 14 },
  metricValue: { fontSize: 26, lineHeight: 34 },
  table: { borderWidth: 1, borderColor: BrandColors.border, borderRadius: Radii.small, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, padding: Spacing.three, borderBottomWidth: 1, borderBottomColor: BrandColors.border },
  tableName: { flexBasis: 180, flexGrow: 1 },
  tableTotal: { width: 64, fontWeight: 800 },
  tableDetail: { flexBasis: 240, flexGrow: 2 },
});