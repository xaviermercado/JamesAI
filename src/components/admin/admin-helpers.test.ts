import { describe, expect, it } from 'vitest';

import { fieldErrorMap, formatPercent, formatSigned, utcDateDaysAgo } from './admin-helpers';

describe('admin display helpers', () => {
  it('formats bounded rates and signed comparison deltas', () => {
    expect(formatPercent(0.125)).toBe('12.5%');
    expect(formatSigned(12)).toBe('+12');
    expect(formatSigned(-0.025, true)).toBe('-2.5 pp');
  });

  it('uses UTC calendar dates and maps field errors', () => {
    expect(utcDateDaysAgo(7, new Date('2026-08-07T23:00:00.000Z'))).toBe('2026-07-31');
    expect(fieldErrorMap([{ field: 'rules.hard.minimumRating', message: 'Too high' }])).toEqual({
      'rules.hard.minimumRating': 'Too high',
    });
  });
});