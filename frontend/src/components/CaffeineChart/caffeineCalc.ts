/** Pure caffeine decay math. No React dependencies. */

import type { CaffeineSensitivity } from '../../types/enums'

const HALF_LIFE: Record<CaffeineSensitivity, number> = {
  fast: 2.5,
  normal: 4.0,
  slow: 6.0,
}

export interface CaffeinePoint {
  hour: number
  mg: number
}

export interface CaffeineEntry {
  time: string | null
  amount_mg: number
}

/**
 * Compute caffeine remaining at each 15-minute interval from 00:00 to 23:45.
 * remaining_mg = dose_mg * 0.5^(elapsed_hours / half_life)
 */
export function computeDecayCurve(
  entries: CaffeineEntry[],
  sensitivity: CaffeineSensitivity,
): CaffeinePoint[] {
  const halfLife = HALF_LIFE[sensitivity]
  const points: CaffeinePoint[] = []

  for (let minutes = 0; minutes < 24 * 60; minutes += 15) {
    const hour = minutes / 60
    let totalMg = 0

    for (const entry of entries) {
      if (!entry.time) continue
      const [h, m] = entry.time.split(':').map(Number)
      const entryHour = h + m / 60
      const elapsed = hour - entryHour
      if (elapsed < 0) continue
      totalMg += entry.amount_mg * Math.pow(0.5, elapsed / halfLife)
    }

    points.push({ hour, mg: Math.round(totalMg * 10) / 10 })
  }

  return points
}
