export const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;
export const seg = (p: number, start: number, end: number): number =>
  Math.max(0, Math.min(1, (p - start) / (end - start)));

export const DURATIONS = [3500, 2500, 9000, 12000];
export const FEATURE_COUNT = DURATIONS.length;
export const HOLD_AFTER_MS = 1400;
