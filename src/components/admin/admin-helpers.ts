import type { ConfigurationFieldError, JamesConfiguration, StoredConfiguration } from '@/types/admin';

export function utcDateDaysAgo(days: number, now = new Date()): string {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatSigned(value: number, percent = false): string {
  const formatted = percent ? `${(Math.abs(value) * 100).toFixed(1)} pp` : String(Math.abs(value));
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatted}`;
}

export function parseStoredConfiguration(stored: StoredConfiguration): JamesConfiguration {
  return structuredClone(stored.configuration);
}

export function fieldErrorMap(errors: ConfigurationFieldError[]): Record<string, string> {
  return Object.fromEntries(errors.map((error) => [error.field, error.message]));
}

