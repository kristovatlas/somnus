/** Pure caffeine decay math and hour/clock helpers. No React dependencies. */

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

/** Format a fractional hour (e.g. 22.5) as a 12-hour clock label ("10:30 PM"). Wraps past 24 (24.5 → "12:30 AM"). */
export function formatClockLabel(hour: number): string {
  const totalMinutes = Math.round(hour * 60);
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/**
 * Wrap an after-midnight bedtime onto the evening scale: hours before 6 AM
 * shift to 24+ so that 00:30 becomes 24.5. Mirrors the backend's
 * `_normalize_bedtime_hour` (dashboard_service.py, cutoff 6).
 */
export function wrapBedtimeHour(hour: number): number {
  return hour < 6 ? hour + 24 : hour;
}

/**
 * End of the decay-curve domain (fractional hours) for an optional bedtime:
 * the default 24 h day, extended just past the wrapped bedtime when it falls
 * after midnight so the curve and x-axis reach the bedtime marker.
 */
export function curveEndHour(bedtimeHour: number | null | undefined): number {
  if (bedtimeHour == null) return 24;
  return Math.max(24, wrapBedtimeHour(bedtimeHour) + 0.5);
}

/**
 * Compute caffeine remaining at each 15-minute interval from 00:00 up to
 * (but not including) `endHour` (default 24, i.e. 00:00 to 23:45).
 * remaining_mg = dose_mg * 0.5^(elapsed_hours / half_life)
 */
export function computeDecayCurve(
  entries: CaffeineEntry[],
  sensitivity: CaffeineSensitivity,
  endHour = 24,
): CaffeinePoint[] {
  const halfLife = HALF_LIFE[sensitivity];
  const points: CaffeinePoint[] = [];

  for (let minutes = 0; minutes < endHour * 60; minutes += 15) {
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
