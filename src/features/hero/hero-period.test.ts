import { describe, expect, it } from 'vitest';

import { getHeroPeriod, getHeroPresentationData } from './hero-period';

// Construct local dates explicitly to avoid timezone-ambiguous string parsing.
const at = (h: number, m = 0) => new Date(2026, 7, 4, h, m, 0);

describe('getHeroPeriod', () => {
  it('returns night at 05:59', () => expect(getHeroPeriod(at(5, 59))).toBe('night'));
  it('returns day at 06:00', () => expect(getHeroPeriod(at(6, 0))).toBe('day'));
  it('returns day at 12:00', () => expect(getHeroPeriod(at(12, 0))).toBe('day'));
  it('returns day at 17:59', () => expect(getHeroPeriod(at(17, 59))).toBe('day'));
  it('returns night at 18:00', () => expect(getHeroPeriod(at(18, 0))).toBe('night'));
  it('returns night at 23:59', () => expect(getHeroPeriod(at(23, 59))).toBe('night'));
});

describe('getHeroPresentationData', () => {
  it('heading and period match at 05:59', () => {
    const p = getHeroPresentationData(at(5, 59));
    expect(p.period).toBe('night');
    expect(p.heading).toMatch(/tonight/);
  });

  it('heading and period match at 06:00', () => {
    const p = getHeroPresentationData(at(6, 0));
    expect(p.period).toBe('day');
    expect(p.heading).toMatch(/today/);
  });

  it('heading and period match at 17:59', () => {
    const p = getHeroPresentationData(at(17, 59));
    expect(p.period).toBe('day');
    expect(p.heading).toMatch(/today/);
  });

  it('heading and period match at 18:00', () => {
    const p = getHeroPresentationData(at(18, 0));
    expect(p.period).toBe('night');
    expect(p.heading).toMatch(/tonight/);
  });

  it('day and night presentations have distinct headings', () => {
    const day = getHeroPresentationData(at(10, 0));
    const night = getHeroPresentationData(at(21, 0));
    expect(day.heading).not.toBe(night.heading);
    expect(day.period).toBe('day');
    expect(night.period).toBe('night');
  });

  it('uses the approved wording "wanna" in both headings', () => {
    const day = getHeroPresentationData(at(10, 0));
    const night = getHeroPresentationData(at(21, 0));
    expect(day.heading).toContain('wanna');
    expect(night.heading).toContain('wanna');
  });

  it('each presentation includes a non-empty overlayColor', () => {
    const day = getHeroPresentationData(at(10, 0));
    const night = getHeroPresentationData(at(21, 0));
    expect(day.overlayColor.length).toBeGreaterThan(0);
    expect(night.overlayColor.length).toBeGreaterThan(0);
  });

  it('heading and overlayColor are always consistent with period', () => {
    for (let hour = 0; hour < 24; hour++) {
      const d = getHeroPresentationData(at(hour));
      if (d.period === 'day') {
        expect(d.heading).toMatch(/today/);
      } else {
        expect(d.heading).toMatch(/tonight/);
      }
      expect(d.overlayColor).toBeTruthy();
    }
  });
});
