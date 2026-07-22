# Wave 2 report — 2026-07-22

Four lanes, four PRs, all merged autonomously under the ship v0.2.0 Phase 4 gate
with green post-merge dev runs: #140 (evening-clock fix, #134), #138 (nav
redesign, #36), #139 (monthly best/worst night detail, #113), #141 (stats
renames, #37/#38 — the PR carrying this report). Milestone v0.1.1 after the
wave: 18 closed / 4 open (#107, #109, #110, #117 remain, plus de-milestoned
follow-ups tracked separately). Plan: `docs/waves/2026-07-22-wave-2.md`.

## 1. Decisions needed

1. **#142 — evening-clock wrap window.** #134's fix wraps any time before
   6 AM onto the 24+ clock for last-caffeine/meal/stimulating. Codex (P2)
   pointed out a genuine 5:30 AM early-riser coffee also wraps and beats
   afternoon entries as the day's "last". I shipped the fix as decided in #134
   and filed the tradeoff. **Recommendation:** narrow the wrap window for
   consumption events to `< 4 AM` (post-midnight caffeine/meals cluster
   00:00–03:00; 4–6 AM reads as morning); bedtime keeps `< 6`. One-line change
   plus tests whenever you say go — or tell me your own logging habits decide
   it and we document instead.
2. **#143 — export Rating column shows raw enum values** (`on_target`,
   `somewhat_inconsistent`, and `drifting` right above "Weekend Drift").
   Pre-existing, found by #141's battery. **Recommendation:** display-map at
   the export (underscores→spaces) and rename δ's band word so "drift" stays
   reserved for Weekend Drift — needs your pick for the replacement word
   (e.g. "off target").

## 2. Conversations worth having (judgment calls made autonomously)

- **"Bedtime Offset (7d avg)"** is my disambiguation for the Analysis
  predictor `delta_7d`: the dashboard's "Bedtime offset" measures distance
  from your *target*, the analysis one distance from your *7-day average* —
  the renames had accidentally given both the same name, and the glossary
  definition only matches the dashboard one. Check the new label reads
  sensibly in the Analysis list.
- **#139's weekday line**: "Tue · bed 11:42 PM" uses the night-*ending* date
  (the Oura convention every other surface uses), so a pre-midnight bedtime
  on the "Tuesday" card actually happened Monday evening. Reviewed, decided
  to stay consistent with the repo-wide convention rather than invent a
  different day attribution for one card. Watch whether it misleads you in
  practice.
- **"slept" → "bed"**: #139 originally labeled the bedtime clock "slept
  11:42 PM", but the field is Oura's `bedtime_start` (time into bed);
  sleep onset differs by the 10–30 min latency Oura stores separately. Now
  says "bed 11:42 PM" in both SPA and export.
- **Recommender fold (scope overflow, recorded):** #140's battery found rec
  copy could render "around 25:00" once column means wrap past midnight;
  fixed by folding means back onto the 0–24 clock at the single format site.
  `recommender.py` was not in lane 1's predicted touch-set.
- **Planning defects, owned:** the wave plan listed `stats_engine.py` in
  lanes 1+3 and `report_service.py` in lanes 3+4 — a pairwise-disjointness
  violation by the plan's author (me). No merge-time edits resulted; the
  serialized merge order + hash-bound re-attestation absorbed it, but the
  next plan gets a real file-level conflict check before lanes launch.
  Lane 3 also overflowed its predicted frontend-only touch-set (backend
  `VARIABLE_LABELS`, rec copy, PLAN.md example, three CSS files) — the
  renames genuinely live on those surfaces; recorded, not re-planned.
- **Process wobble, owned:** a probe of a not-yet-finished Codex leg output
  file read as a missing leg (#121's failure mode), and I briefly launched a
  duplicate scan racing the original for the same output file. Caught it,
  killed the duplicate, attested from the completed original's canonical
  report. Lesson recorded: batch pipelines write output only on completion —
  check the process, not the file.

## 3. What shipped

- **#138 — nav redesign (#36).** The decided direction B: six labeled icon
  buttons (pencil Log, grid Dashboard, chart Analysis, lightbulb Coach,
  file-text Reports, gear Settings), curved indicator under the active icon,
  title routes to Dashboard. Review round added: accessible name "Somnus —
  go to Dashboard" (WCAG 2.5.3), Enter/Space activation, focus-visible
  outline, and an icon-only collapse below 640 px (tooltips and screen-reader
  names keep every destination labeled).
- **#140 — evening-clock normalization (#134).** Last caffeine / last meal /
  stimulating-activity hours now share bedtime's continuous evening clock
  (00:30 → 24.5), so after-midnight entries stop sorting as the earliest of
  the day and corrupting correlations. The #132 display suppression is
  lifted — these predictors show slopes and binned contrasts again. Rec copy
  folds wrapped averages back to clock time. Tests pin per-column semantics,
  the 6 AM boundary, and an end-to-end correlation sign-flip.
- **#141 — stats renames (#37/#38).** Greek is gone from every user surface:
  σ→"Variability", δ→"Bedtime offset", Δ→"Weekend drift"; "Typical"→"Target"
  bedtime display; analysis `delta_7d` disambiguated to "Bedtime Offset
  (7d avg)" with matching rec copy; onboarding + settings explain what the
  targets power (bedtime target → countdown, caffeine-chart marker,
  consistency stats; wake target → Auto display-mode schedule); consistency
  pills wrap on narrow cards; stale help cursor dropped.
- **#139 — monthly best/worst night context (#113).** Best/worst night cards
  (SPA + HTML export) now carry a detail line — "Tue · bed 11:42 PM · 7h 38m
  · deep 71m · REM 96m · HRV 44" — with omit-when-NULL sparse rendering per
  ADR 003 and every export hole escaped or numeric-typed (mutation-tested).

All four batteries ran the full 4-leg gate (Claude Fable 5 + Codex gpt-5.5
xhigh, review + security each); artifacts under `docs/reviews/pr-{138,139,
140,141}/`. Codex security scans: 0 findings on all four, coverage complete.

## 4. Verification asks (dogfood)

1. **Nav:** use it a day — labels, the lightbulb-Coach read, active
   indicator. Shrink the window under 640 px: icons only, tooltips intact.
   Tab to the title and hit Enter.
2. **Analysis:** last caffeine / last meal rows should now show effect
   sentences and binned contrasts; with your after-midnight entries the
   values should finally sort sensibly. If a rec mentions caffeine/meal
   timing, confirm the clock time reads sane (never "around 25:00").
3. **Dashboard/report pills:** "Variability / Bedtime offset / Weekend
   drift" wording, and no overflow at mid-width windows.
4. **Monthly report:** open best/worst nights — does the "bed" line match
   what Oura shows for those nights? Export the HTML and compare the same
   line.
