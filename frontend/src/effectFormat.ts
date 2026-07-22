/** #17: effect sizes in plain language — the slope headline and the
 * median-split evidence line. r is real but demoted; these are what a
 * user can act on. Pure module (react-refresh: no components here). */

import type { BinnedContrast, EffectSize } from "./types";

function fmtMagnitude(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 10) return abs.toFixed(0);
  return abs.toFixed(1);
}

/** "≈2.3 points lower Sleep Score per hour later" — or, with no outcome
 * label, the compact "≈2.3 points lower per hour later" (used where the
 * outcome is already stated, e.g. the Top Factors card). Null when the
 * predictor has no meaningful per-unit slope (binary/unmapped). */
export function effectHeadline(
  effect: EffectSize | null,
  outcomeLabel = "",
): string | null {
  if (!effect || effect.value === 0) return null;
  const direction = effect.value > 0 ? "higher" : "lower";
  const unit = effect.outcome_unit ? `${effect.outcome_unit} ` : "";
  const outcome = outcomeLabel ? `${outcomeLabel} ` : "";
  return `≈${fmtMagnitude(effect.value)} ${unit}${direction} ${outcome}per ${effect.increment_label}`;
}

/** "before 11:34 PM: avg 88 · after 11:34 PM: 82 (n=20/24)" */
export function contrastLine(contrast: BinnedContrast | null): string | null {
  if (!contrast) return null;
  return (
    `${contrast.low_label}: avg ${contrast.low_mean} · ` +
    `${contrast.high_label}: ${contrast.high_mean} ` +
    `(n=${contrast.n_low}/${contrast.n_high})`
  );
}
