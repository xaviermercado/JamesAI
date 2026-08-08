import { useEffect, useEffectEvent, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AdminPage } from '@/components/admin/admin-shell';
import { utcDateDaysAgo } from '@/components/admin/admin-helpers';
import { AdminButton, AdminField, AdminSection, ChoiceGroup, StatusMessage, adminRowStyle } from '@/components/admin/admin-ui';
import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedText } from '@/components/themed-text';
import { BrandColors, Radii, Spacing } from '@/constants/theme';
import { categorizeFeedback, listFeedbackInbox } from '@/services/admin-api';
import { FEEDBACK_REVIEW_CATEGORIES, type FeedbackInboxItemDto, type FeedbackReviewCategory } from '@/types/admin';

const CATEGORY_OPTIONS = FEEDBACK_REVIEW_CATEGORIES.map((value) => ({ value, label: value.replaceAll('_', ' ') }));

export default function AdminFeedbackScreen() {
  const { csrfToken } = useAuthSession();
  const [startDate, setStartDate] = useState(() => utcDateDaysAgo(29));
  const [endDate, setEndDate] = useState(() => utcDateDaysAgo(0));
  const [reviewStatus, setReviewStatus] = useState<'all' | 'categorized' | 'uncategorized'>('uncategorized');
  const [items, setItems] = useState<FeedbackInboxItemDto[]>([]);
  const [selections, setSelections] = useState<Record<string, FeedbackReviewCategory>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await listFeedbackInbox({ startDate, endDate, reviewStatus: reviewStatus === 'all' ? undefined : reviewStatus, pageSize: 50 });
      setItems(page.items);
      setSelections(Object.fromEntries(page.items.map((item) => [item.analyticsEventId, item.review?.category ?? 'bad_match'])));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load minimized feedback.');
    } finally {
      setLoading(false);
    }
  };

  const loadInitial = useEffectEvent(load);
  useEffect(() => {
    const timeoutId = setTimeout(() => { void loadInitial(); }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  const saveCategory = async (item: FeedbackInboxItemDto) => {
    const category = selections[item.analyticsEventId];
    if (!csrfToken || !category) return;
    setBusyId(item.analyticsEventId);
    setError(null);
    setMessage(null);
    try {
      await categorizeFeedback(item.analyticsEventId, category, item.review?.rowVersion ?? null, csrfToken);
      setMessage('Feedback category saved.');
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to categorize feedback. Refresh before retrying.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminPage title="Feedback" description="Review only minimized event fields. Prompts, titles, identities, and free text are not available here.">
      <AdminSection title="Inbox filters">
        <View style={adminRowStyle}>
          <AdminField label="Start date" value={startDate} onChangeText={setStartDate} />
          <AdminField label="End date" value={endDate} onChangeText={setEndDate} />
          <ChoiceGroup label="Review status" value={reviewStatus} options={[{ value: 'all', label: 'All' }, { value: 'uncategorized', label: 'Uncategorized' }, { value: 'categorized', label: 'Categorized' }]} onChange={setReviewStatus} />
          <AdminButton label="Apply filters" onPress={() => void load()} disabled={loading} />
        </View>
      </AdminSection>
      <StatusMessage message={error} tone="error" />
      <StatusMessage message={message} tone="success" />
      <AdminSection title="Minimized feedback events">
        {loading ? <ActivityIndicator accessibilityLabel="Loading feedback" color={BrandColors.scoutyBlue} /> : null}
        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.analyticsEventId} style={styles.item}>
              <View style={styles.summary}>
                <ThemedText type="smallBold">{item.feedbackCategory.replaceAll('_', ' ')} · {item.mediaType}</ThemedText>
                <ThemedText themeColor="textSecondary">{new Date(item.occurredAt).toLocaleString()} · {item.sourceSurface} · {item.authenticated ? 'authenticated' : 'anonymous'}</ThemedText>
                <ThemedText style={styles.idText}>Event {item.analyticsEventId}</ThemedText>
              </View>
              <ChoiceGroup label="Review category" value={selections[item.analyticsEventId] ?? 'bad_match'} options={CATEGORY_OPTIONS} onChange={(category) => setSelections((current) => ({ ...current, [item.analyticsEventId]: category }))} />
              <AdminButton label="Save category" onPress={() => void saveCategory(item)} disabled={busyId === item.analyticsEventId} />
            </View>
          ))}
          {!loading && items.length === 0 ? <ThemedText themeColor="textSecondary">No feedback events match these filters.</ThemedText> : null}
        </View>
      </AdminSection>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  list: { borderTopWidth: 1, borderTopColor: BrandColors.border },
  item: { gap: Spacing.three, paddingVertical: Spacing.four, borderBottomWidth: 1, borderBottomColor: BrandColors.border },
  summary: { gap: Spacing.one, padding: Spacing.three, borderRadius: Radii.small, backgroundColor: BrandColors.surface },
  idText: { fontSize: 12 },
});