import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/app-footer';
import { AppHeader } from '@/components/app-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BrandColors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { getContactCsrfToken, submitContactMessage } from '@/services/contact-api';

export default function ContactScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getContactCsrfToken()
      .then((token) => {
        if (active) {
          setCsrfToken(token);
        }
      })
      .catch(() => {
        if (active) {
          setError('Unable to prepare contact form right now. Please refresh and try again.');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const submit = async () => {
    setError(null);
    setSuccess(null);

    if (!csrfToken) {
      setError('Security token is missing. Please refresh and try again.');
      return;
    }

    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setError('Please complete all required fields.');
      return;
    }

    setBusy(true);
    try {
      await submitContactMessage({
        name,
        email,
        subject,
        message,
        website,
      }, csrfToken);

      setSuccess('Thanks for reaching out. Your message has been sent.');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      setWebsite('');
      const nextToken = await getContactCsrfToken();
      setCsrfToken(nextToken);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to send your message right now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <ThemedText type="subtitle">Contact</ThemedText>
            <ThemedText themeColor="textSecondary">Have feedback or a partnership idea? Send us a note.</ThemedText>

            <View style={styles.fieldGroup}>
              <ThemedText style={styles.label}>Name</ThemedText>
              <TextInput value={name} onChangeText={setName} style={styles.input} autoComplete="name" />
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText style={styles.label}>Email</ThemedText>
              <TextInput value={email} onChangeText={setEmail} style={styles.input} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText style={styles.label}>Subject</ThemedText>
              <TextInput value={subject} onChangeText={setSubject} style={styles.input} />
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText style={styles.label}>Message</ThemedText>
              <TextInput value={message} onChangeText={setMessage} style={[styles.input, styles.messageInput]} multiline numberOfLines={6} textAlignVertical="top" />
            </View>

            {/* Honeypot field for bot detection. */}
            <View style={styles.honeypotWrap} aria-hidden>
              <ThemedText style={styles.label}>Website</ThemedText>
              <TextInput value={website} onChangeText={setWebsite} style={styles.input} autoCapitalize="none" />
            </View>

            <Pressable style={[styles.primaryButton, busy && { opacity: 0.65 }]} onPress={() => void submit()} disabled={busy}>
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <ThemedText style={styles.primaryButtonText}>Send message</ThemedText>}
            </Pressable>

            {success ? <ThemedText style={styles.successText}>{success}</ThemedText> : null}
            {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
          </View>
          <AppFooter />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  contentContainer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.four,
  },
  card: {
    borderRadius: Radii.large,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  fieldGroup: { gap: Spacing.one },
  label: { fontWeight: '600', color: BrandColors.ink },
  input: {
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.medium,
    backgroundColor: '#fff',
    paddingHorizontal: Spacing.two,
    paddingVertical: 12,
    minHeight: 44,
  },
  messageInput: { minHeight: 140 },
  honeypotWrap: {
    position: 'absolute',
    left: -10000,
    width: 1,
    height: 1,
    opacity: 0,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: Radii.pill,
    backgroundColor: BrandColors.scoutyBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  successText: { color: '#166534' },
  errorText: { color: '#b42318' },
});
