import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AdminPage } from '@/components/admin/admin-shell';
import { confirmAdminAction } from '@/components/admin/admin-confirmation';
import { fieldErrorMap } from '@/components/admin/admin-helpers';
import { hasAdminCapability } from '@/components/admin/admin-permissions';
import { AdminButton, AdminField, AdminSection, ChoiceGroup, MultiChoiceGroup, StatusMessage, adminGridStyle, adminRowStyle } from '@/components/admin/admin-ui';
import { BASELINE_CONFIGURATION, parseNumberList, parseNumberOrNull, parsePriorities, parseStringList, parseTitleControls, validateGuidance } from '@/components/admin/guidance-helpers';
import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedText } from '@/components/themed-text';
import { BrandColors, Radii, Spacing } from '@/constants/theme';
import { createConfigurationDraft, listConfigurations, previewConfiguration, publishConfiguration, saveConfigurationDraft, validateConfigurationDraft } from '@/services/admin-api';
import { HttpRequestError } from '@/services/http-client';
import type { ConfigurationAdapterOutput, GuidanceCampaign, JamesConfiguration, PriorityPosition, StoredConfiguration } from '@/types/admin';

const AXES: { key: keyof JamesConfiguration['priorityAxes']; label: string; low: string; high: string }[] = [
  { key: 'popularityVsDiscovery', label: 'Popularity or discovery', low: 'Popular', high: 'Discovery' },
  { key: 'mainstreamVsNiche', label: 'Mainstream or niche', low: 'Mainstream', high: 'Niche' },
  { key: 'recentVsClassic', label: 'Recent or classic', low: 'Recent', high: 'Classic' },
  { key: 'safeVsAdventurous', label: 'Safe or adventurous', low: 'Safe', high: 'Adventurous' },
  { key: 'conciseVsEpic', label: 'Concise or epic', low: 'Concise', high: 'Epic' },
  { key: 'familiarVsDiverse', label: 'Familiar or diverse', low: 'Familiar', high: 'Diverse' },
];

const POSITION_OPTIONS = [-2, -1, 0, 1, 2].map((value) => ({ value: value as PriorityPosition, label: String(value) }));

function nullableText(value: number | null): string { return value === null ? '' : String(value); }
function priorityText(items: { id: number | string; position: number }[]): string { return items.map((item) => `${item.id}:${item.position}`).join(', '); }
function titleText(items: { mediaType: string; tmdbId: number }[]): string { return items.map((item) => `${item.mediaType}:${item.tmdbId}`).join(', '); }

function DeferredField({ label, value, onCommit, error, hint, multiline, keyboardType }: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  error?: string;
  hint?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
}) {
  return <AdminField key={`${label}-${value}`} label={label} defaultValue={value} onEndEditing={(event) => onCommit(event.nativeEvent.text)} error={error} hint={hint} multiline={multiline} keyboardType={keyboardType} />;
}

export default function AdminGuidanceScreen() {
  const { user, csrfToken } = useAuthSession();
  const [stored, setStored] = useState<StoredConfiguration | null>(null);
  const [configuration, setConfiguration] = useState<JamesConfiguration>(() => structuredClone(BASELINE_CONFIGURATION));
  const [initialSnapshot, setInitialSnapshot] = useState(JSON.stringify(BASELINE_CONFIGURATION));
  const [changeReason, setChangeReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ConfigurationAdapterOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const canPublish = hasAdminCapability(user?.adminRole, 'publish_configuration');
  const dirty = useMemo(() => JSON.stringify(configuration) !== initialSnapshot, [configuration, initialSnapshot]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await listConfigurations();
        const draft = response.items.find((item) => item.status === 'draft') ?? null;
        if (!active || !draft) return;
        setStored(draft);
        setConfiguration(structuredClone(draft.configuration));
        setInitialSnapshot(JSON.stringify(draft.configuration));
        setChangeReason(draft.changeReason ?? '');
      } catch (nextError) {
        if (active) setError(nextError instanceof Error ? nextError.message : 'Unable to load guidance.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!dirty || typeof window === 'undefined') return undefined;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (next: JamesConfiguration) => { setConfiguration(next); setPreview(null); setMessage(null); };
  const replaceHard = (values: Partial<JamesConfiguration['rules']['hard']>) => update({ ...configuration, rules: { ...configuration.rules, hard: { ...configuration.rules.hard, ...values } } });
  const replaceSoft = (values: Partial<JamesConfiguration['rules']['soft']>) => update({ ...configuration, rules: { ...configuration.rules, soft: { ...configuration.rules.soft, ...values } } });

  const beginAction = () => { setBusy(true); setError(null); setMessage(null); };
  const failAction = (nextError: unknown, fallback: string) => {
    if (nextError instanceof HttpRequestError && nextError.fieldErrors.length) setErrors(fieldErrorMap(nextError.fieldErrors));
    setError(nextError instanceof Error ? nextError.message : fallback);
    setBusy(false);
  };

  const save = async () => {
    if (!csrfToken) return;
    const localErrors = validateGuidance(configuration);
    setErrors(localErrors);
    if (Object.keys(localErrors).length) { setError('Some guidance fields need attention.'); return; }
    beginAction();
    try {
      const response = stored
        ? await saveConfigurationDraft(stored.configurationId, stored.rowVersion, configuration, changeReason.trim() || null, csrfToken)
        : await createConfigurationDraft(configuration, changeReason.trim() || null, csrfToken);
      setStored(response.configuration);
      setConfiguration(structuredClone(response.configuration.configuration));
      setInitialSnapshot(JSON.stringify(response.configuration.configuration));
      setErrors({});
      setMessage(`Draft version ${response.configuration.versionNumber} saved.`);
      setBusy(false);
    } catch (nextError) { failAction(nextError, 'Unable to save guidance.'); }
  };

  const validate = async () => {
    if (!stored || !csrfToken || dirty) { setError('Save the current changes before validating.'); return; }
    beginAction();
    try {
      const response = await validateConfigurationDraft(stored.configurationId, stored.rowVersion, csrfToken);
      setStored(response.configuration);
      setErrors(fieldErrorMap(response.fieldErrors));
      setMessage(response.fieldErrors.length ? `Validation found ${response.fieldErrors.length} field issue(s).` : 'Guidance is valid.');
      setBusy(false);
    } catch (nextError) { failAction(nextError, 'Unable to validate guidance.'); }
  };

  const runPreview = async () => {
    if (!csrfToken) return;
    beginAction();
    try {
      const response = await previewConfiguration(configuration, csrfToken);
      setPreview(response.adapterOutput);
      setErrors(fieldErrorMap(response.fieldErrors));
      setMessage('Resolved parameters preview updated.');
      setBusy(false);
    } catch (nextError) { failAction(nextError, 'Unable to preview guidance.'); }
  };

  const publish = async () => {
    if (!canPublish || !stored || !csrfToken || dirty) return;
    const confirmed = await confirmAdminAction('Publish guidance?', `Version ${stored.versionNumber} will become active immediately. Recent reauthentication is required by the server.`);
    if (!confirmed) return;
    beginAction();
    try {
      const response = await publishConfiguration(stored.configurationId, stored.rowVersion, csrfToken);
      setStored(response.configuration);
      setMessage(`Version ${response.configuration.versionNumber} published.`);
      setBusy(false);
    } catch (nextError) { failAction(nextError, 'Unable to publish guidance.'); }
  };

  const discard = async () => {
    if (!dirty) return;
    const confirmed = await confirmAdminAction('Discard unsaved changes?', 'The editor will return to the last saved guidance.');
    if (!confirmed) return;
    const next = stored?.configuration ?? structuredClone(BASELINE_CONFIGURATION);
    setConfiguration(structuredClone(next));
    setInitialSnapshot(JSON.stringify(next));
    setErrors({});
    setPreview(null);
    setMessage('Unsaved changes discarded.');
  };

  const addCampaign = () => {
    const next: GuidanceCampaign = { campaignId: 'new-campaign', name: 'New campaign', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 86_400_000).toISOString(), priorityBoost: 0, providerIds: [], genreIds: [], languageCodes: [], titleIds: [], editorialNote: null };
    update({ ...configuration, campaigns: [...configuration.campaigns, next] });
  };

  if (loading) return <AdminPage title="Guidance" description="Loading the current draft."><ActivityIndicator accessibilityLabel="Loading guidance" color={BrandColors.scoutyBlue} /></AdminPage>;

  return (
    <AdminPage title="Guidance" description="Edit plain-language recommendation policy. Changes remain a draft until explicitly saved and, for owners, published."
      actions={<><AdminButton label="Discard" tone="secondary" onPress={() => void discard()} disabled={!dirty || busy} /><AdminButton label="Save draft" onPress={() => void save()} disabled={!dirty || busy} /><AdminButton label="Validate" tone="secondary" onPress={() => void validate()} disabled={!stored || dirty || busy} />{canPublish ? <AdminButton label="Publish" tone="danger" onPress={() => void publish()} disabled={!stored || dirty || busy || stored.validationStatus !== 'valid'} /> : null}</>}>
      <StatusMessage message={error} tone="error" />
      <StatusMessage message={message} tone="success" />
      <AdminSection title="Draft details" description={stored ? `Version ${stored.versionNumber} · ${stored.validationStatus} · row ${stored.rowVersion}` : 'Saving will create a new draft.'}>
        <AdminField label="Change reason" value={changeReason} onChangeText={setChangeReason} maxLength={240} hint="Briefly explain why this guidance is changing." />
      </AdminSection>
      <AdminSection title="Editorial philosophy">
        <AdminField label="Philosophy statement" value={configuration.philosophy.statement ?? ''} multiline onChangeText={(statement) => update({ ...configuration, philosophy: { ...configuration.philosophy, statement: statement || null } })} error={errors['philosophy.statement']} />
        <AdminField label="Editorial notes" value={configuration.philosophy.editorialNotes.join('\n')} multiline onChangeText={(value) => update({ ...configuration, philosophy: { ...configuration.philosophy, editorialNotes: value.split('\n').map((item) => item.trim()).filter(Boolean) } })} hint="One note per line, up to 12." error={errors['philosophy.editorialNotes']} />
      </AdminSection>
      <AdminSection title="Priority axes" description="-2 strongly favors the left label; +2 strongly favors the right label.">
        <View style={adminGridStyle}>{AXES.map((axis) => <ChoiceGroup key={axis.key} label={`${axis.low} ← ${axis.label} → ${axis.high}`} value={configuration.priorityAxes[axis.key]} options={POSITION_OPTIONS} onChange={(value) => update({ ...configuration, priorityAxes: { ...configuration.priorityAxes, [axis.key]: value } })} />)}</View>
      </AdminSection>
      <AdminSection title="Content priorities" description="Enter comma-separated ID:position pairs, such as 8:2, 337:-1.">
        <View style={adminGridStyle}>
          <DeferredField label="Provider priorities" value={priorityText(configuration.contentPriorities.providers)} onCommit={(value) => update({ ...configuration, contentPriorities: { ...configuration.contentPriorities, providers: parsePriorities(value, true) } })} error={errors['contentPriorities.providers']} />
          <DeferredField label="Genre priorities" value={priorityText(configuration.contentPriorities.genres)} onCommit={(value) => update({ ...configuration, contentPriorities: { ...configuration.contentPriorities, genres: parsePriorities(value, true) } })} error={errors['contentPriorities.genres']} />
          <DeferredField label="Language priorities" value={priorityText(configuration.contentPriorities.languages)} onCommit={(value) => update({ ...configuration, contentPriorities: { ...configuration.contentPriorities, languages: parsePriorities(value, false) } })} error={errors['contentPriorities.languages']} />
        </View>
      </AdminSection>
      <AdminSection title="Hard rules" description="Hard rules constrain eligible recommendations.">
        <MultiChoiceGroup label="Media types" values={configuration.rules.hard.mediaTypes} options={[{ value: 'movie', label: 'Movies' }, { value: 'tv', label: 'TV' }]} onChange={(mediaTypes) => replaceHard({ mediaTypes })} />
        <View style={adminGridStyle}>
          <DeferredField label="Provider IDs" value={configuration.rules.hard.providerIds.join(', ')} onCommit={(value) => replaceHard({ providerIds: parseNumberList(value) })} />
          <DeferredField label="Genre IDs" value={configuration.rules.hard.genreIds.join(', ')} onCommit={(value) => replaceHard({ genreIds: parseNumberList(value) })} />
          <DeferredField label="Language codes" value={configuration.rules.hard.languageCodes.join(', ')} onCommit={(value) => replaceHard({ languageCodes: parseStringList(value) })} />
          <DeferredField label="Minimum rating" keyboardType="decimal-pad" value={nullableText(configuration.rules.hard.minimumRating)} onCommit={(value) => replaceHard({ minimumRating: parseNumberOrNull(value) })} error={errors['rules.hard.minimumRating']} />
          <DeferredField label="Maximum runtime minutes" keyboardType="number-pad" value={nullableText(configuration.rules.hard.maximumRuntimeMinutes)} onCommit={(value) => replaceHard({ maximumRuntimeMinutes: parseNumberOrNull(value) })} />
          <DeferredField label="Earliest release year" keyboardType="number-pad" value={nullableText(configuration.rules.hard.earliestReleaseYear)} onCommit={(value) => replaceHard({ earliestReleaseYear: parseNumberOrNull(value) })} />
          <DeferredField label="Latest release year" keyboardType="number-pad" value={nullableText(configuration.rules.hard.latestReleaseYear)} onCommit={(value) => replaceHard({ latestReleaseYear: parseNumberOrNull(value) })} error={errors['rules.hard.latestReleaseYear']} />
        </View>
      </AdminSection>
      <AdminSection title="Soft targets" description="Soft targets influence ranking without excluding titles.">
        <View style={adminGridStyle}>
          <DeferredField label="Target minimum rating" keyboardType="decimal-pad" value={nullableText(configuration.rules.soft.minimumRating)} onCommit={(value) => replaceSoft({ minimumRating: parseNumberOrNull(value) })} />
          <DeferredField label="Target runtime minutes" keyboardType="number-pad" value={nullableText(configuration.rules.soft.targetRuntimeMinutes)} onCommit={(value) => replaceSoft({ targetRuntimeMinutes: parseNumberOrNull(value) })} />
          <DeferredField label="Target release year" keyboardType="number-pad" value={nullableText(configuration.rules.soft.targetReleaseYear)} onCommit={(value) => replaceSoft({ targetReleaseYear: parseNumberOrNull(value) })} />
        </View>
      </AdminSection>
      <AdminSection title="Campaigns" description="Campaigns apply only between their ISO start and end times.">
        <AdminButton label="Add campaign" tone="secondary" onPress={addCampaign} />
        {configuration.campaigns.map((campaign, index) => (
          <View key={`${campaign.campaignId}-${index}`} style={styles.campaign}>
            <View style={adminGridStyle}>
              <AdminField label={`Campaign ${index + 1} ID`} value={campaign.campaignId} onChangeText={(campaignId) => update({ ...configuration, campaigns: configuration.campaigns.map((item, itemIndex) => itemIndex === index ? { ...item, campaignId } : item) })} error={errors[`campaigns.${index}.campaignId`]} />
              <AdminField label="Name" value={campaign.name} onChangeText={(name) => update({ ...configuration, campaigns: configuration.campaigns.map((item, itemIndex) => itemIndex === index ? { ...item, name } : item) })} error={errors[`campaigns.${index}.name`]} />
              <AdminField label="Starts at" value={campaign.startsAt} onChangeText={(startsAt) => update({ ...configuration, campaigns: configuration.campaigns.map((item, itemIndex) => itemIndex === index ? { ...item, startsAt } : item) })} error={errors[`campaigns.${index}.startsAt`]} />
              <AdminField label="Ends at" value={campaign.endsAt} onChangeText={(endsAt) => update({ ...configuration, campaigns: configuration.campaigns.map((item, itemIndex) => itemIndex === index ? { ...item, endsAt } : item) })} error={errors[`campaigns.${index}.endsAt`]} />
              <ChoiceGroup label="Priority boost" value={campaign.priorityBoost} options={POSITION_OPTIONS} onChange={(priorityBoost) => update({ ...configuration, campaigns: configuration.campaigns.map((item, itemIndex) => itemIndex === index ? { ...item, priorityBoost } : item) })} />
              <DeferredField label="Provider IDs" value={campaign.providerIds.join(', ')} onCommit={(value) => update({ ...configuration, campaigns: configuration.campaigns.map((item, itemIndex) => itemIndex === index ? { ...item, providerIds: parseNumberList(value) } : item) })} />
              <DeferredField label="Genre IDs" value={campaign.genreIds.join(', ')} onCommit={(value) => update({ ...configuration, campaigns: configuration.campaigns.map((item, itemIndex) => itemIndex === index ? { ...item, genreIds: parseNumberList(value) } : item) })} />
              <DeferredField label="Language codes" value={campaign.languageCodes.join(', ')} onCommit={(value) => update({ ...configuration, campaigns: configuration.campaigns.map((item, itemIndex) => itemIndex === index ? { ...item, languageCodes: parseStringList(value) } : item) })} />
              <DeferredField label="Title IDs" value={titleText(campaign.titleIds)} onCommit={(value) => update({ ...configuration, campaigns: configuration.campaigns.map((item, itemIndex) => itemIndex === index ? { ...item, titleIds: parseTitleControls(value) } : item) })} hint="movie:123, tv:456" />
              <AdminField label="Editorial note" value={campaign.editorialNote ?? ''} multiline onChangeText={(editorialNote) => update({ ...configuration, campaigns: configuration.campaigns.map((item, itemIndex) => itemIndex === index ? { ...item, editorialNote: editorialNote || null } : item) })} />
            </View>
            <AdminButton label="Remove campaign" tone="danger" onPress={() => update({ ...configuration, campaigns: configuration.campaigns.filter((_, itemIndex) => itemIndex !== index) })} />
          </View>
        ))}
      </AdminSection>
      <AdminSection title="Title controls" description="Use comma-separated media type and TMDB ID pairs, such as movie:12, tv:34.">
        <View style={adminGridStyle}>
          <DeferredField label="Always include" value={titleText(configuration.titleControls.include)} onCommit={(value) => update({ ...configuration, titleControls: { ...configuration.titleControls, include: parseTitleControls(value) } })} error={errors['titleControls.include']} />
          <DeferredField label="Always exclude" value={titleText(configuration.titleControls.exclude)} onCommit={(value) => update({ ...configuration, titleControls: { ...configuration.titleControls, exclude: parseTitleControls(value) } })} error={errors['titleControls.exclude']} />
        </View>
      </AdminSection>
      <AdminSection title="Resolved parameters preview" description="This server preview validates the current editor values and shows deterministic filters, ranking inputs, and precedence.">
        <View style={adminRowStyle}><AdminButton label="Preview resolved parameters" onPress={() => void runPreview()} disabled={busy} /></View>
        {preview ? <View style={styles.preview}>
          <ThemedText type="smallBold">Filters</ThemedText><ThemedText>{`Media: ${preview.filters.mediaTypes.join(', ') || 'any'} · Providers: ${preview.filters.providerIds.join(', ') || 'any'} · Genres: ${preview.filters.genreIds.join(', ') || 'any'} · Languages: ${preview.filters.languageCodes.join(', ') || 'any'}`}</ThemedText>
          <ThemedText type="smallBold">Ranking</ThemedText><ThemedText>{`${preview.ranking.activeCampaigns.length} active campaign(s) · ${preview.ranking.providerPriorities.length} provider priorities · ${preview.ranking.genrePriorities.length} genre priorities`}</ThemedText>
          <ThemedText type="smallBold">Precedence</ThemedText><ThemedText>{preview.precedence.join(' → ')}</ThemedText>
        </View> : null}
      </AdminSection>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  campaign: { gap: Spacing.three, padding: Spacing.three, borderWidth: 1, borderColor: BrandColors.border, borderRadius: Radii.small, backgroundColor: '#f8faff' },
  preview: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radii.small, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
});