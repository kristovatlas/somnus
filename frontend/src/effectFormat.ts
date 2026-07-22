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
 * predictor has no meaningful per-unit slope (binary/unmapped), or when the
 * displayed magnitude would round to 0.0 — "≈0.0 points lower" reads as a
 * claim of no effect, so suppress the headline entirely. */
export function effectHeadline(
  effect: EffectSize | null,
  outcomeLabel = "",
): string | null {
  if (!effect || Math.abs(effect.value) < 0.05) return null;
  const direction = effect.value > 0 ? "higher" : "lower";
  const unit = effect.outcome_unit ? `${effect.outcome_unit} ` : "";
  const outcome = outcomeLabel ? `${outcomeLabel} ` : "";
  return `≈${fmtMagnitude(effect.value)} ${unit}${direction} ${outcome}per ${effect.increment_label}`;
}

/** Duration idiom for minute-unit outcome averages (#147): "7h 27m", or
 * "45m" under an hour — same style as the monthly night line's
 * `_fmt_duration` (which always shows the hour part; here sub-hour values
 * drop it, per the issue spec). Rounded to whole minutes; a rounded-up
 * 59.6 correctly becomes "1h 0m". */
function fmtMinutesAsDuration(v: number): string {
  const total = Math.round(v);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** True for the minute-unit outcomes (total_sleep_minutes, deep_minutes,
 * rem_minutes, onset_latency_minutes) — mirrors _OUTCOME_UNITS === "min"
 * in stats_engine.py without duplicating the map: every minute outcome
 * (and only those) ends in "minutes". */
function isMinuteOutcome(outcome: string): boolean {
  return outcome.endsWith("minutes");
}

/** "11:34 PM or earlier: avg 88 · after 11:34 PM: 82 (n=20/24)" — or, for
 * minute-unit outcomes, "12:10 AM or earlier: avg 7h 27m · after 12:10 AM:
 * 7h 3m (n=182/179)" (#147, owner-decided). Pass the CorrelationResult's
 * `outcome` name; defaults to raw numbers when omitted. */
export function contrastLine(
  contrast: BinnedContrast | null,
  outcome = "",
): string | null {
  if (!contrast) return null;
  const fmt = isMinuteOutcome(outcome)
    ? fmtMinutesAsDuration
    : (v: number) => `${v}`;
  return (
    `${contrast.low_label}: avg ${fmt(contrast.low_mean)} · ` +
    `${contrast.high_label}: ${fmt(contrast.high_mean)} ` +
    `(n=${contrast.n_low}/${contrast.n_high})`
  );
}
