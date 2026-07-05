# Review findings: PR #32 — Fix nap entry UX (quick-add + 2-of-3 auto-compute)

- **Status:** PENDING — action items not yet applied
- **Reviewed:** 2026-07-04 (8 finder angles → dedup → 1 verifier per candidate)
- **PR:** #32 `fix/nap-entry-ux` → `dev` (stacked on #31, already merged; true scope is 3 files:
  `NapSection.tsx`, `NapSection.test.tsx`, `e2e/daily-log.spec.ts`)
- **CI at review time:** all 6 checks green
- Line numbers refer to the PR branch (`origin/fix/nap-entry-ux`).

## Findings (most severe first)

### 1. [ ] End time ≤ start time derives duration 1440 → whole-day save fails silently — CONFIRMED
`frontend/src/components/DailyLog/sections/NapSection.tsx:75`

`reconcile()` computes `duration_minutes: diff > 0 ? diff : diff + 1440`. Setting End Time equal
to Start Time (one click of the TimePicker "Now" button on both fields in the same minute, or
picking the same time) gives diff = 0 → duration **1440**. Backend `NapEntryCreate` has
`Field(ge=1, le=240)` (`backend/schemas.py:197`), naps are nested in the composite
`PUT /api/daily-log/{date}`, so the **entire day's save returns 422 and nothing persists**.
`useDailyLog.save` has `try/finally` with no catch and no error UI — the failure is silent
(button just flips back to "Save"). Same outcome for any backwards end time whose wrapped
duration exceeds 240 (e.g. start 14:00, end 13:00 → 1380).

**Fix:** special-case `diff === 0` (set duration null or block), and only accept wrapped
durations ≤ 240; surface save errors (see issue #35 — this bug is a concrete trigger for it).

### 2. [ ] Fractional duration produces invalid end_time "HH:60:00" and a 422 — CONFIRMED
`frontend/src/components/DailyLog/sections/NapSection.tsx:27`

`minutesToTimeStr` rounds only the minutes remainder: `Math.round(59.7) = 60` with `hh` floored
from the unrounded total. Typing a decimal duration (e.g. `29.7` with start 14:30; NumberInput
passes `Number(e.target.value)` through unclamped, `step` is not set) yields
`end_time "14:60:00"` — the time input blanks (HTML value sanitization) while state keeps the
bad value. Save 422s twice over: `time_parsing` on the end time and `int_from_float` on the
fractional `duration_minutes` (both verified against the real Pydantic schema).

**Fix:** `Math.round(total)` once at function entry (verified: 899.7 → "15:00:00"), **and**
round/integerize duration in `updateField` or NumberInput — the fractional int 422s on its own.

### 3. [ ] Out-of-range durations rewrite end_time; corrupted value can persist — CONFIRMED
`frontend/src/components/DailyLog/sections/NapSection.tsx:44-59` (derivation), `:109` (no guard)

HTML `min=1/max=240` don't constrain typed values. Typing `-30` (start 14:00) sets end 13:30 —
before start; `1500` silently wraps past midnight. Old code quarantined bad values in the
duration field only. Escape path that **persists** corruption: type bad duration (end_time
rewritten) → clear duration (reconcile's `== null` branch returns entry unchanged, keeping the
corrupted end_time) → save succeeds (200) since `ge=1` no longer applies and there is no
cross-field validation.

**Fix:** derive only when `Number.isInteger(d) && d >= 1 && d <= 240` in `reconcile`/`updateField`.

### 4. [ ] Quick-add near midnight stores factually wrong end_time — PLAUSIBLE (low)
`frontend/src/components/DailyLog/sections/NapSection.tsx:99-106` (+ wrap at `:25`)

"+ 20 min nap" at 23:50 stores `{start 23:50, end 00:10, duration 20}` on today's date — the
end is actually tomorrow. Pre-PR quick-add stored `end_time: null` ("not recorded", ADR 003
spirit). No current consumer computes end−start (all backend analysis uses `duration_minutes`
only), so impact today is nil — data-semantics wart, not a live bug.

**Fix (cheap):** leave `end_time` null when `start + duration >= 1440`.

### 5. [ ] 2-of-3 invariant enforced only in the React component — CONFIRMED (pre-existing; follow-up, not a merge blocker)
`backend/schemas.py:194-197` (no `model_validator`; none anywhere in the file)

Live UI-bypassing write paths exist today (`POST/PUT /api/daily-log/{date}/naps`, composite
PUT). A nap stored with start+end but NULL duration **half-vanishes**: excluded from
`nap_total_minutes` (`stats_engine.py:195`), report factors (`report_service.py:215`), and all
nap-analysis segments (`nap_analysis.py:67`), while still counting toward `nap_count` and
`total_nap_days` — inconsistent aggregates. Server-side derivation of the missing third field
in a Pydantic `model_validator` is arithmetic over recorded values (ADR-003-compliant; same
precedent the PR sets client-side). **Action:** file a follow-up issue.

### 6. [ ] `updateField` erases the field↔value type link — CONFIRMED (minor, PR-introduced)
`frontend/src/components/DailyLog/sections/NapSection.tsx:109-113`

`value: string | number | null` admits `updateField(i, "duration_minutes", "20")` (compiles
under this repo's strict tsc — verified empirically); reconcile would then string-concatenate
into a wrong end_time. All current call sites are correctly typed, so preventive only.

**Fix (compile-verified drop-in):**
`const updateField = <K extends NapField>(index: number, field: K, value: NapEntryCreate[K]) => ...`

### 7. [ ] E2e nap-card locator is page-global, ancestor-dependent, and duplicated — CONFIRMED (latent)
`frontend/e2e/daily-log.spec.ts:45-48` and `:68-71` (verbatim copy)

`page.locator("div").filter({ has: Remove button }).last()` matches every ancestor div of every
Remove button; 11 DailyLog sections render Remove buttons per entry and Naps is not last in the
DOM (Sunlight, RedLight, NSDR follow). Safe today only because the DB-reset fixture guarantees
exactly one entry exists; any future entry in a post-Nap section silently retargets `.last()`.

**Fix:** add `data-testid="nap-entry"` to the nap card div (`NapSection.tsx:139`, currently a
bare styled div) and extract one helper used at both call sites.

### 8. [ ] Quick-add button style is now a 5th copy — CONFIRMED (cleanup)
`frontend/src/components/DailyLog/sections/NapSection.tsx:88-96`

`quickAddStyle` duplicates `.caffeine-quick-btn` (`CaffeineSection.css:7-13`; rendered result
identical — the global `button` rule in `themes.css:131-139` supplies radius/cursor) plus
verbatim inline copies in NSDRSection, SupplementSection, HabitSection.

**Fix:** promote one shared `.quick-add-btn` class (5 declarations suffice) used by Caffeine,
NSDR, Supplement, Habit, Nap. Note: do NOT cite Meal/PreBedRitual/Stimulating/RedLight — those
carry a different (Remove/dashed-add) style.

## Verified non-issues (do not re-flag)
- **E2e save race** (`toBeEnabled` after Save click): REFUTED. React flushes `setSaving(true)`
  synchronously within the click dispatch, so an enabled button strictly implies the PUT
  settled; pattern matches the two pre-existing tests. (Optional diagnosability tweak:
  `page.waitForResponse` on the PUT makes a failed save fail loudly at the save step.)
- **Start-edit overwrites end / can't store inconsistent trios**: REFUTED — documented,
  tested anchoring design; exactly what issue #13 requested. PLAN.md defines naps as
  start + duration; `end_time` is never read by analysis.

## Suggested fix order
Findings 1–3 share one root fix: validate inside `reconcile`/`updateField` (integer duration
1–240, `diff === 0` special case) — one small PR on top of #32 (or pushed to its branch)
covers them plus 4 and 6 in the same file. 7–8 are test/style cleanups; 5 is a new backend
issue.

---

Resolution (2026-07-04, fix/nap-entry-ux):
1. FIXED — reconcile() only derives durations in [1, 240]; same-time and
   over-cap wraps clear the stale duration instead of storing junk.
2. FIXED — minutesToTimeStr rounds once at entry; updateField integerizes
   typed durations (29.7 → 30).
3. FIXED — out-of-range durations no longer rewrite end_time (quarantined
   in the duration field; nothing derived).
4. FIXED — quick-add/derivation crossing midnight leaves the far boundary
   null ("not recorded") instead of a same-day time.
5. FILED — backend model_validator follow-up: issue #40.
6. FIXED — updateField is generic over NapField, restoring the
   field↔value type link.
7. FIXED — nap card has data-testid="nap-entry"; both e2e sites use it.
8. FIXED — shared .quick-add-btn class in themes.css; Caffeine, Nap,
   NSDR, Supplement, Habit all use it (bespoke copies removed).
