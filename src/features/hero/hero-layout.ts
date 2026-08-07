export const HERO_MOBILE_BREAKPOINT = 768;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isHeroMobileLayout(viewportWidth: number): boolean {
  return viewportWidth < HERO_MOBILE_BREAKPOINT;
}

export function getMobileHeroTitleMetrics(viewportWidth: number): { fontSize: number; lineHeight: number } {
  const fontSize = clamp(viewportWidth * 0.136, 42, 52);
  const lineHeight = clamp(fontSize * 0.98, 41, 54);
  return { fontSize, lineHeight };
}
