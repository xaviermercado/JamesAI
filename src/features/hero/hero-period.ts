// Day: 06:00–17:59. Night: 18:00–05:59. Uses device local time.
export type HeroPeriod = 'day' | 'night';

export interface HeroPresentationData {
  period: HeroPeriod;
  heading: string;
  overlayColor: string;
}

export function getHeroPeriod(date: Date): HeroPeriod {
  const hour = date.getHours();
  return hour >= 6 && hour < 18 ? 'day' : 'night';
}

/** Returns the time-dependent copy and overlay without loading image assets. */
export function getHeroPresentationData(date: Date): HeroPresentationData {
  const period = getHeroPeriod(date);
  return period === 'day'
    ? { period, heading: 'What do you wanna watch today?', overlayColor: 'rgba(4, 28, 80, 0.30)' }
    : { period, heading: 'What do you wanna watch tonight?', overlayColor: 'rgba(7, 21, 47, 0.22)' };
}
