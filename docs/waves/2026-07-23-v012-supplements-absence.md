# v0.1.2 stacked chain — explicit absence + supplement analysis

Owner-directed 2026-07-23. Build-all-at-once, merged as a **stacked chain**
(each branch off the previous, reviewed separately, merged in order) — the
lanes are dependent, so this is not a parallel wave. Decisions settled with
the owner: full scope in one push; per-supplement absence (not section-level);
pull the supplement input-speed work in (#110, #160) since we're unlocking
supplement usefulness and logging must stay fast enough to sustain the data.

Base `dev`, release `main`. Gate live (4-leg battery per PR, required
`review-gate` check). Worktrees under `.claude/worktrees/`.

## Why a chain, not a wave
Lane 2 needs Lane 1's absence semantics; Lane 3 needs Lane 1's schema/API;
Lane 4's coverage list needs Lanes 1–2's predictor set. Shared files
(`stats_engine.py`, `schemas.py`, `DailyLogPage.tsx`) recur across lanes —
legal in a stack (sequential), illegal in a wave (parallel).

## Escalation / data posture
- Schema is **purely additive** (new absence records; existing `daily_logs`
  untouched; a blank day still means "not recorded"/unknown). No
  "beyond additive-nullable" migration → no separate data escalation.
- **ADR 003 amendment** (the third data state) is the reviewable
  data-semantics decision; owner directed it 2026-07-23. Ships in Lane 1.
- Lane 3 is a **new user-facing flow** → UX mockup to the owner for sign-off
  before building.

## Lane 1 — #159 absence core (feat/159-absence-core)
The third data state: *did it* (value) / *explicitly did not* (recorded 0/
False) / *not recorded* (NULL, excluded). Unlocks the 8 binary habits, which
are currently uncorrelatable (all-1.0-or-NULL → zero variance → always
skipped).
- **Schema:** additive `section_absences` table `(id, date FK→daily_logs,
  section_key str)`. `section_key` is a section id (e.g. `caffeine`,
  `alcohol`, `nsdr`) or a namespaced supplement key (`supplement:melatonin`,
  Lane 2 uses that form). Existing logs: no rows = unchanged semantics.
- **Aggregation** (`_aggregate_daily_log`): a section marked absent maps its
  column(s) to the explicit zero — binary → `0.0`, continuous → `0`
  (`total_caffeine_mg=0`, `nap_total_minutes=0`, etc.; clock/"last-hour"
  columns stay NULL — there is no time when it didn't happen). A blank
  section stays NULL.
- **ADR 003 amendment** documenting the three states + why absence ≠ missing.
- Touch-set: `backend/models.py`, `backend/migrations|alembic/<new>`,
  `backend/services/stats_engine.py` (`_aggregate_daily_log`),
  `backend/schemas.py`, `docs/adr/003-*.md`, `backend/tests/test_stats_engine.py`,
  this plan file.

## Lane 2 — per-supplement predictors (feat/…, off Lane 1)
Supplements are logged (`SupplementEntry` name+dose) but never analyzed. Make
each regularly-taken supplement a did-vs-didn't predictor.
- Aggregate `supplement_entries` by **canonical name** (case-insensitive,
  trimmed) into dynamic predictor columns (`supplement_<canon>` present=1.0/
  dose; absence via `supplement:<canon>` key → 0.0). Min-frequency threshold
  so one-off supplements don't spawn noise predictors.
- Dynamic predictor discovery: `prepare_analysis_dataframe` emits the
  supplement columns it observes; `compute_correlations` iterates df columns
  incl. the `supplement_` family; `VARIABLE_LABELS` renders "Melatonin", etc.
- Touch-set: `backend/services/stats_engine.py`, `backend/schemas.py`,
  `backend/tests/*`.

## Lane 3 — Daily Log UX + input speed (frontend, off Lane 2)
**UX mockup → owner sign-off before build.**
- Generic **"None today"** affordance per log section (distinct visual state
  from blank), and per-supplement "didn't take it" marking.
- **#110:** "same as yesterday" quick-add + common-dose prefill chips.
- **#160:** supplement name autocomplete / canonical picker (recent + common)
  so repeat logs group into one predictor.
- Touch-set: `frontend/src/components/DailyLog/*`, new components, `api/`,
  `types/`, `frontend/src/**/*.test.tsx`.

## Lane 4 — #158 coverage / countdown (backend + frontend, off Lane 3)
- Backend: per-predictor coverage in the analysis response — co-logged non-
  sick day count, and exclusion reason (`too_few_days` N/14 · `no_variance` ·
  `needs_on_off_days` for binary/absence-gated).
- Frontend: list the not-yet-unlocked correlations with countdowns / prompts.
- Touch-set: `backend/services/stats_engine.py`, `backend/routers/analysis.py`,
  `backend/schemas.py`, `frontend/src/components/Analysis/*`, tests.

## Issues
#159 (absence, priority), per-supplement analysis (Lane 2 — file if not yet
tracked as its own issue), #158 (coverage), #110 + #160 (supplement input).
