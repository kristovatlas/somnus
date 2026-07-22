# Wave 1 report — v0.1.1 papercuts (2026-07-22)

Committed copy of the wave-1 report delivered to the owner (Phase 5); rides
the first wave-2 lane per the plan.

## Shipped (5 lanes, all autonomous merges)

- **#17 effect sizes** (PR #132): slope headline + binned contrast in natural
  units, r demoted; three review/fix rounds before the gate passed.
- **#105 venv**: `make setup` creates/uses `.venv` when none is active;
  README documents it.
- **#106 caffeine chart labels**: bedtime marker labeled, "≈N mg at bedtime"
  callout; a validated-P1 fix landed in review for the after-midnight
  callout case.
- **#108 lux presets**: sunlight section gains lux preset buttons.
- **#112 honest rolling-window copy**: dashboard copy now states the actual
  window semantics.

Milestone after the wave: 15 closed / 6 open.

## Decisions

- **#36 settled**: nav rebuild design confirmed by the owner, including the
  lightbulb Coach icon; builds in wave 2.

## Watch items

- **#134 filed**: PR #132's battery (Codex P2 + Claude P3, convergent) found
  the evening-time predictors (last caffeine/meal/stimulating hour) are raw
  0-24 clock, so after-midnight events corrupt those correlations; display
  suppressed in #132, fix scheduled as wave-2 lane 1.
- **#112 wording refined** during review before merge.
- **Process miss (owned)**: report ordering — the wave report went out before
  its committed copy landed in-repo; this file is the make-good, and future
  waves commit the copy with the wave's first merge.
