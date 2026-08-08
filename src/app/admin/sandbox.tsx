import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AdminPage } from '@/components/admin/admin-shell';
import { AdminButton, AdminField, AdminSection, ChoiceGroup, StatusMessage, adminGridStyle, adminRowStyle } from '@/components/admin/admin-ui';
import { useAuthSession } from '@/components/auth-session-provider';
import { ThemedText } from '@/components/themed-text';
import { BrandColors, Radii, Spacing } from '@/constants/theme';
import { listConfigurations, runConfigurationSandbox } from '@/services/admin-api';
import type { SandboxExample, SandboxResultDto, StoredConfiguration } from '@/types/admin';

const EMPTY_EXAMPLE: SandboxExample = { description: '', mediaType: 'movie' };

export default function AdminSandboxScreen() {
  const { csrfToken } = useAuthSession();
  const [versions, setVersions] = useState<StoredConfiguration[]>([]);
  const [configurationId, setConfigurationId] = useState('');
  const [examples, setExamples] = useState<SandboxExample[]>([{ ...EMPTY_EXAMPLE }]);
  const [result, setResult] = useState<SandboxResultDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await listConfigurations();
        if (!active) return;
        const valid = response.items.filter((item) => item.validationStatus === 'valid');
        setVersions(valid);
        setConfigurationId(valid[0]?.configurationId ?? '');
      } catch (nextError) {
        if (active) setError(nextError instanceof Error ? nextError.message : 'Unable to load sandbox versions.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const updateExample = (index: number, values: Partial<SandboxExample>) => {
    setExamples((current) => current.map((example, itemIndex) => itemIndex === index ? { ...example, ...values } : example));
    setResult(null);
  };

  const run = async () => {
    if (!csrfToken || !configurationId) return;
    if (examples.some((example) => !example.description.trim())) {
      setError('Each sandbox example needs a short description.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setResult(await runConfigurationSandbox(configurationId, examples.map((example) => ({
        ...example,
        description: example.description.trim(),
        country: example.country?.trim().toUpperCase() || undefined,
      })), csrfToken));
      setMessage('Sandbox comparison complete. Inputs were not returned in the response.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to run the sandbox.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage title="Sandbox" description="Compare a valid configuration with the active configuration. Inputs and provider details are never returned in the response.">
      <StatusMessage message={error} tone="error" />
      <StatusMessage message={message} tone="success" />
      <AdminSection title="Selected configuration" description="Runs are isolated from product analytics and do not change the active configuration.">
        {loading ? <ActivityIndicator accessibilityLabel="Loading sandbox versions" color={BrandColors.scoutyBlue} /> : null}
        <ChoiceGroup
          label="Valid configuration version"
          value={configurationId}
          options={versions.map((version) => ({ value: version.configurationId, label: `v${version.versionNumber} · ${version.status}` }))}
          onChange={(value) => { setConfigurationId(value); setResult(null); }}
        />
        {!loading && versions.length === 0 ? <ThemedText themeColor="textSecondary">No valid configuration is available. Validate a draft first.</ThemedText> : null}
      </AdminSection>
      <AdminSection title="Examples" description="Add one to five short test cases. Examples are sent only to the protected server sandbox.">
        {examples.map((example, index) => (
          <View key={index} style={styles.example}>
            <View style={adminGridStyle}>
              <AdminField label={`Example ${index + 1} description`} value={example.description} onChangeText={(description) => updateExample(index, { description })} maxLength={300} multiline />
              <ChoiceGroup label="Media type" value={example.mediaType} options={[{ value: 'movie', label: 'Movie' }, { value: 'tv', label: 'TV' }]} onChange={(mediaType) => updateExample(index, { mediaType })} />
              <AdminField label="Country code" value={example.country ?? ''} onChangeText={(country) => updateExample(index, { country })} maxLength={2} autoCapitalize="characters" hint="Optional two-letter code." />
            </View>
            {examples.length > 1 ? <AdminButton label={`Remove example ${index + 1}`} tone="danger" onPress={() => setExamples((current) => current.filter((_, itemIndex) => itemIndex !== index))} /> : null}
          </View>
        ))}
        <View style={adminRowStyle}>
          <AdminButton label="Add example" tone="secondary" onPress={() => setExamples((current) => [...current, { ...EMPTY_EXAMPLE }])} disabled={examples.length >= 5 || busy} />
          <AdminButton label="Run sandbox" onPress={() => void run()} disabled={!configurationId || busy || loading} />
        </View>
      </AdminSection>
      {result ? (
        <AdminSection title="Safe comparison summary" description={`Active ${result.activeConfigurationId} · selected ${result.selectedConfigurationId}`}>
          {result.results.map((item) => (
            <View key={item.example} style={styles.resultRow}>
              <ThemedText type="smallBold" style={styles.resultHeading}>Example {item.example}</ThemedText>
              <View style={styles.sideBySide}>
                <View style={styles.resultSide}>
                  <ThemedText type="smallBold">Active</ThemedText>
                  <ThemedText>{item.active.count} result(s)</ThemedText>
                  {item.active.items.map((recommendation, index) => (
                    <View key={`${recommendation.mediaType}:${recommendation.title}:${index}`} style={styles.recommendation}>
                      <ThemedText type="smallBold">{recommendation.title}</ThemedText>
                      <ThemedText themeColor="textSecondary">{recommendation.mediaType === 'movie' ? 'Movie' : 'TV'} · {recommendation.availability === 'available' ? 'Availability found' : 'Availability not confirmed'}</ThemedText>
                      <ThemedText>{recommendation.explanation}</ThemedText>
                    </View>
                  ))}
                  {item.active.items.length === 0 ? <ThemedText themeColor="textSecondary">No results</ThemedText> : null}
                </View>
                <View style={styles.resultSide}>
                  <ThemedText type="smallBold">Selected</ThemedText>
                  <ThemedText>{item.selected.count} result(s)</ThemedText>
                  {item.selected.items.map((recommendation, index) => (
                    <View key={`${recommendation.mediaType}:${recommendation.title}:${index}`} style={styles.recommendation}>
                      <ThemedText type="smallBold">{recommendation.title}</ThemedText>
                      <ThemedText themeColor="textSecondary">{recommendation.mediaType === 'movie' ? 'Movie' : 'TV'} · {recommendation.availability === 'available' ? 'Availability found' : 'Availability not confirmed'}</ThemedText>
                      <ThemedText>{recommendation.explanation}</ThemedText>
                    </View>
                  ))}
                  {item.selected.items.length === 0 ? <ThemedText themeColor="textSecondary">No results</ThemedText> : null}
                </View>
              </View>
            </View>
          ))}
        </AdminSection>
      ) : null}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  example: { paddingVertical: Spacing.three, gap: Spacing.two, borderBottomWidth: 1, borderBottomColor: BrandColors.border },
  resultRow: { gap: Spacing.two, paddingVertical: Spacing.three, borderBottomWidth: 1, borderBottomColor: BrandColors.border },
  resultHeading: { fontSize: 18 },
  sideBySide: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  resultSide: { flexBasis: 280, flexGrow: 1, minWidth: 0, padding: Spacing.three, borderRadius: Radii.small, borderWidth: 1, borderColor: BrandColors.border, backgroundColor: BrandColors.surface, gap: Spacing.one },
  recommendation: { paddingTop: Spacing.two, gap: Spacing.one, borderTopWidth: 1, borderTopColor: BrandColors.border },
});