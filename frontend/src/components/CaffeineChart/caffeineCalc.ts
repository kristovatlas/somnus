/** Pure caffeine decay math. No React dependencies. */

import type { CaffeineSensitivity } from "../../types/enums";

const HALF_LIFE: Record<CaffeineSensitivity, number> = {
  fast: 2.5,
  normal: 4.0,
  slow: 6.0,
};

export interface CaffeinePoint {
  hour: number;
  mg: number;
}

export interface CaffeineEntry {
  time: string | null;
  amount_mg: number;
}

/**
 * Compute caffeine remaining at each 15-minute interval from 00:00 to 23:45.
 * remaining_mg = dose_mg * 0.5^(elapsed_hours / half_life)
 */
export function computeDecayCurve(
  entries: CaffeineEntry[],
  sensitivity: CaffeineSensitivity,
): CaffeinePoint[] {
  const halfLife = HALF_LIFE[sensitivity];
  const points: CaffeinePoint[] = [];

  for (let minutes = 0; minutes < 24 * 60; minutes += 15) {
    const hour = minutes / 60;
    let totalMg = 0;

    for (const entry of entries) {
      if (!entry.time) continue;
      const [h, m] = entry.time.split(":").map(Number);
      const entryHour = h + m / 60;
      const elapsed = hour - entryHour;
      if (elapsed < 0) continue;
      totalMg += entry.amount_mg * Math.pow(0.5, elapsed / halfLife);
    }

    points.push({ hour, mg: Math.round(totalMg * 10) / 10 });
  }

  return points;
}

/**
 * Modeled caffeine level (mg) at an arbitrary hour, read off an existing
 * decay curve by linear interpolation between its 15-minute samples.
 * Clamps to the first/last sample outside the curve's range.
 * Returns 0 for an empty curve.
 */
export function mgAtHour(points: CaffeinePoint[], hour: number): number {
  if (points.length === 0) return 0;
  if (hour <= points[0].hour) return points[0].mg;
  const last = points[points.length - 1];
  if (hour >= last.hour) return last.mg;
  for (let i = 1; i < points.length; i++) {
    if (points[i].hour >= hour) {
      const prev = points[i - 1];
      const next = points[i];
      const t = (hour - prev.hour) / (next.hour - prev.hour);
      return prev.mg + t * (next.mg - prev.mg);
    }
  }
  return last.mg;
}
