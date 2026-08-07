import { describe, expect, it } from 'vitest';

import {
  getMobileHeroTitleMetrics,
  HERO_MOBILE_BREAKPOINT,
  isHeroMobileLayout,
} from '../features/hero/hero-layout';

describe('hero recommendation responsive helpers', () => {
  it('uses mobile layout below the breakpoint and desktop at or above it', () => {
    expect(isHeroMobileLayout(HERO_MOBILE_BREAKPOINT - 1)).toBe(true);
    expect(isHeroMobileLayout(HERO_MOBILE_BREAKPOINT)).toBe(false);
    expect(isHeroMobileLayout(1280)).toBe(false);
  });

  it('keeps mobile heading size within the approved readable range', () => {
    const verySmall = getMobileHeroTitleMetrics(320);
    const medium = getMobileHeroTitleMetrics(390);
    const large = getMobileHeroTitleMetrics(430);

    expect(verySmall.fontSize).toBeGreaterThanOrEqual(42);
    expect(verySmall.fontSize).toBeLessThanOrEqual(52);
    expect(medium.fontSize).toBeGreaterThanOrEqual(42);
    expect(medium.fontSize).toBeLessThanOrEqual(52);
    expect(large.fontSize).toBeGreaterThanOrEqual(42);
    expect(large.fontSize).toBeLessThanOrEqual(52);

    expect(verySmall.lineHeight).toBeGreaterThanOrEqual(41);
    expect(large.lineHeight).toBeLessThanOrEqual(54);
  });
});
