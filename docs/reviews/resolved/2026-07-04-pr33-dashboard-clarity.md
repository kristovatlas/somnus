# Review findings: PR #33 — Clarify dashboard (night label, missing metrics, sparkline values, σ/δ/Δ legend)

- **Status:** RESOLVED — see Resolution appendix at the end
- **Reviewed:** 2026-07-04 (8 finder angles → dedup → 1 verifier per candidate)
- **PR:** #33 `fix/dashboard-clarity` → `dev` (stacked on #31, already merged; true scope is 1 commit
  `ddd7e1f` touching 5 files: `ConsistencyMeter.tsx`, `DashboardPage.css`, `DashboardPage.test.tsx`,
  `SleepScoreCard.tsx`, `TrendSparklines.tsx`)
- **Rebase needed:** `gh pr diff 33` shows 147 files because the squash-merge of #31 left the branch's
  merge-base stale — rebase onto `dev` so CI and reviewers see the real ~5-file diff.
- Line numbers refer to the PR branch (`origin/fix/dashboard-clarity` @ `ddd7e1f`).
- Note: this absorbs `pr-33-dashboard-accuracy-regressions.txt` (same directory, recorded earlier
  today by another session) — its 2 items are findings 1 and 2 below.

## Findings (most severe first)

### 1. [x] δ and Δ tooltips assert a direction the backend values don't have — CONFIRMED
`frontend/src/components/Dashboard/ConsistencyMeter.tsx:128` (δ tooltip), `:131` ("+" sign), `:139` (Δ tooltip)

The backend computes both values as **absolute magnitudes**:
- `backend/services/dashboard_service.py:183-184` — `offsets = [abs(h - typical_hour) for h in hours]`;
  `delta_minutes = statistics.mean(offsets) * 60` → always ≥ 0.
- `backend/services/dashboard_service.py:199` — `drift_minutes = abs(mean(weekend) - mean(weekday)) * 60`.

But the new δ tooltip says "Positive = later than usual" and the pill prefixes "+", and the Δ tooltip
says "how much later you go to bed on weekends". A user who shifts **earlier** (bedtime 22:00 vs
typical 23:00) sees `δ +60m` = "an hour later than usual" — the opposite of the truth. Same for
early-weekend users ("Δ 90m" labeled social jet lag). Because the value is always ≥ 0, the "+"
appears on every nonzero δ, so the sign carries no information at all.

The PR description claims "δ is now signed" — only the frontend formatting changed; the backend was
never made signed. The new test asserts `δ +15m` renders, cementing the wrong semantics.

**Fix (pick one):**
- *Real fix:* make the backend values signed (`mean(h - typical_hour)`, `mean(weekend) - mean(weekday)`),
  update rating thresholds to use `abs()`, and keep the frontend sign. Check the other consumer of
  these fields (weekly report, if any) for the same assumption.
- *Wording fix:* keep backend as-is, drop the "+" and reword both tooltips to direction-neutral
  language ("how far, in either direction, …"). Then also fix the test asserting `δ \+15m`.

### 2. [x] Sparkline headline "latest" is the last *non-null* point — stale value shown as current — CONFIRMED
`frontend/src/components/Dashboard/TrendSparklines.tsx:23-24`

`values = points.filter(v => v != null)` then `latest = values[values.length - 1]`. Trends are
chronological (`dashboard_service.py:91` `.order_by(SleepRecord.date)`) and metric fields are
nullable (NULL = not recorded, ADR 003). With HRV `[55, 60, null, null, null, null, null]`, the cell
shows a bold "60ms" as if current while the SleepScoreCard shows "—" for the same night —
contradictory dashboard state, and exactly the "unexplained numbers" confusion issue #14 set out
to fix.

**Fix:** take the headline from `points[points.length - 1]` and render the existing "—" branch when
the most recent day is null (keep min/max over non-null values for the range). Optionally annotate
staleness ("45ms · 3d ago") instead.

### 3. [x] `diffDays <= 0` labels any future-dated record "Last night" — PLAUSIBLE
`frontend/src/components/Dashboard/SleepScoreCard.tsx:22`

A record dated ahead of the browser's local calendar day yields negative `diffDays` → "Last night
(Jul 5)" shown on Jul 4. Reachability is capped by the backend (`dashboard_service.py:79-82` serves
only server-local today/yesterday), so it needs the **server's** date ahead of the **browser's**
(e.g. UTC container + browser in a western timezone during the evening) — plausible for this
locally-run-but-containerized app, not demonstrated.

**Fix:** decide "Last night" by string equality (`record.date === <local today YYYY-MM-DD>`) and let
everything else fall through to "Night ending <date>" — truthful under any clock disagreement, and
simpler than the ms-arithmetic + `Math.round`.

### 4. [x] Third hand-rolled date parse/format + a second "today" definition that disagrees with the first — CONFIRMED (cleanup/altitude)
`frontend/src/components/Dashboard/SleepScoreCard.tsx:10-23`

- Duplication: `dateStr.split("-").map(Number)` + `toLocaleDateString` re-implements the pattern in
  `DateNavigator.tsx:11-18` and `WeeklyReportView.tsx:15-18` (each with a *different* parsing
  strategy); `router.tsx:11` separately duplicates `todayStr()` itself.
- Disagreement: `useDateNavigation.ts:4-6` `todayStr()` is UTC-based (`toISOString().slice(0,10)`)
  while `nightLabel` compares against **local** midnight. At 6pm in UTC-7 the two disagree about
  what "today" is → DailyLog and the dashboard classify the same date differently.

Given this repo's timezone-bug history (cc94453, and the open `fix/timezone-handling` branch), the
today-vs-past comparison belongs in one shared date util (e.g. `frontend/src/utils/date.ts` with
`todayStr`/`isToday`/`formatDate`) used by all four call sites. Fine to land PR #33 with a local
helper, but file the consolidation as a follow-up tied to the timezone work if not done here.

### 5. [x] σ/δ/Δ explanations are hover-only on non-focusable spans; legend says "hover for details" — CONFIRMED (altitude)
`frontend/src/components/Dashboard/ConsistencyMeter.tsx:120,128,139` (title attrs), `:146-148` (legend)

The threshold guidance ("Under 30 min is consistent", "Over 60 min is significant") exists nowhere
else in the DOM; `title` never fires on touch and the pills are plain spans (no tabIndex/aria), so
touch/keyboard users are promised details they cannot reach. Repo-wide grep at `ddd7e1f` shows no
existing tooltip/disclosure component — this PR establishes the app's first tooltip pattern, so it
will be copied.

**Fix:** keep `title` as enhancement but make the content reachable — e.g. a small
"What do these mean?" `<details>` disclosure under the pills, or focusable pills with
`aria-describedby`. (A bedside tablet is a core use case for a sleep dashboard.)

### 6. [x] "+" sign decided on unrounded value, magnitude rounded — "δ +0m" — CONFIRMED (minor)
`frontend/src/components/Dashboard/ConsistencyMeter.tsx:131-132`

Backend returns `round(delta_minutes, 1)` (`dashboard_service.py:214`), so fractional values reach
the client: `delta_minutes = 0.4` → sign from unrounded 0.4 ("+") but `Math.round(0.4)` = 0 →
renders "δ +0m". Round once into a local and derive sign and digits from the same number. This line
is rewritten anyway by whichever branch of finding 1 is taken; if a sign survives, extract a shared
`signed(n)` formatter — the inline `x > 0 ? "+" : ""` pattern already exists verbatim in
`CorrelationHeatmap.tsx:120`, `CorrelationList.tsx:61`, and `NapImpactView.tsx:65` (this is copy #4).

### 7. [x] `anyMetricMissing` hard-codes a second copy of the four pill fields — PLAUSIBLE (cleanup)
`frontend/src/components/Dashboard/SleepScoreCard.tsx:63-67` vs pill row `:107-118`

Add or remove a `MetricPill` later and the missing-metric note silently disagrees with what's
rendered (unexplained dash, or a note with no dash visible). Deriving pills and the boolean from one
metric-descriptor array removes the drift risk; defensible to leave as-is for a 4-item card (the
Eff pill's ×100 transform makes a descriptor array slightly awkward).

## Verified non-issues (do not re-flag)
- **"7d range" label wrong for other windows:** REFUTED — the trend window is fixed server-side at
  7 days (`dashboard_service.py:39` `days=7`; router takes no parameter). The degenerate one-point
  "45–45ms" for brand-new users is transient and contextualized by the card title.
- **Circadian palette (ADR 004):** compliant — every new CSS color is a `var()` reference; no
  hardcoded colors.
- **CLAUDE.md conventions:** no violations found (tests cover both night-label branches, note
  shown/hidden, sparkline values, tooltips/legend).
- **Per-render `new Date()`/filter work:** not worth flagging — dashboard renders ~twice, 7-point arrays.

## Suggested fix order
Finding 1 is the merge blocker (dashboard actively misinforms early-shifters; contradicts the PR's
own description). 2 and 6 are small frontend-only fixes in the same two components — do them in the
same pass. 3 folds into 4's shared `isToday`/`todayStr` util (one small change covers both). 5 is a
markup change in one component. 7 is optional. Rebase onto `dev` before pushing fixes so CI runs on
the true diff.

---

Resolution (2026-07-04, fix/dashboard-clarity):

Findings 1–2 were fixed first in 3d05cac (working from the absorbed
`pr-33-dashboard-accuracy-regressions.txt`); 3–7 in the follow-up commit.
The "rebase needed" header note was settled by merging dev up in-branch
(67d5993) — the PR diff shows the true scope.

1. FIXED — wording fix chosen (3d05cac dropped the "+" and made the δ
   tooltip direction-neutral; this commit rewords the Δ tooltip the same
   way). Backend signing was rejected: σ/δ/Δ ratings treat the values as
   magnitudes, and signed means would cancel opposite-direction offsets.
2. FIXED (3d05cac) — headline is the true most recent day; "—" when that
   day is unrecorded; range still spans recorded days. Test updated.
3. FIXED — "Last night" decided by string equality with the local
   calendar day (`isToday`); everything else, past or future, falls
   through to "Night ending …". Future-date test added.
4. FIXED — new `frontend/src/utils/date.ts` (`parseDateStr`/`toDateStr`/
   `todayStr`/`isToday`/`addDays`/`formatDate`, all local-calendar
   semantics, unit-tested incl. a UTC+14 regression test) now used by
   SleepScoreCard, DateNavigator, WeeklyReportView, router, and
   useDateNavigation — plus two more UTC-today sites the review missed:
   RecommendationsPage (experiment start_date) and CopyDayButton (default
   source date). useDateNavigation's `addDays` also lost its
   toISOString() round-trip, which returned the SAME date at UTC+13/+14.
5. FIXED — σ/δ/Δ glossary is a `<details>` disclosure under the pills
   (summary is keyboard-focusable and touch-tappable); `title` tooltips
   kept as enhancement, sourced from the same help strings; legend no
   longer promises hover.
6. FIXED by finding 1's resolution (3d05cac) — the sign is gone; values
   render as unsigned rounded magnitudes. No `signed(n)` formatter needed
   here; the three pre-existing inline copies elsewhere are untouched.
7. FIXED — pills and the missing-metric note both derive from one metric
   descriptor array (the Eff ×100 transform inlined fine).

Also fixed while verifying: e2e `completeOnboarding` returned at
`waitForURL(/\/log\//)` with the /log page's daily-log fetch still in
flight; its expected 404 (empty day) could bleed into the next test's
console-error assertions (navigation.spec "pages load without errors"
flaked twice locally once utils/date joined the /log module graph). The
helper now waits for networkidle before returning. Full Playwright suite
verified green twice in a row after the change.
