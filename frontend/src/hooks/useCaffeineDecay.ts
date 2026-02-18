import { useMemo } from 'react'
import {
  computeDecayCurve,
  type CaffeineEntry,
  type CaffeinePoint,
} from '../components/CaffeineChart/caffeineCalc'
import type { CaffeineSensitivity } from '../types/enums'

export function useCaffeineDecay(
  entries: CaffeineEntry[],
  sensitivity: CaffeineSensitivity,
): CaffeinePoint[] {
  return useMemo(
    () => computeDecayCurve(entries, sensitivity),
    [entries, sensitivity],
  )
}
