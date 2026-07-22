import { useMemo } from "react";
import {
  computeDecayCurve,
  curveEndHour,
  type CaffeineEntry,
  type CaffeinePoint,
} from "../components/CaffeineChart/caffeineCalc";
import type { CaffeineSensitivity } from "../types/enums";

export function useCaffeineDecay(
  entries: CaffeineEntry[],
  sensitivity: CaffeineSensitivity,
  bedtimeHour: number | null = null,
): CaffeinePoint[] {
  return useMemo(
    () => computeDecayCurve(entries, sensitivity, curveEndHour(bedtimeHour)),
    [entries, sensitivity, bedtimeHour],
  );
}
