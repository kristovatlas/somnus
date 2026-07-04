# Review findings: PR #34 — Fix onboarding UX (storage order, chronotype default, caffeine guidance, toggle states)

- **Status:** PENDING — action items not yet applied
- **Reviewed:** 2026-07-04 (8 finder angles → dedup → 1 verifier per candidate)
- **PR:** #34 `fix/onboarding-ux` → `dev` (stacked on #31, already merged; true scope is one
  commit `f34caca` touching 10 frontend files)
- **CI at review time:** all 6 checks green
- Line numbers refer to the PR branch (`origin/fix/onboarding-ux`).

The four fixes themselves are well-executed: the step reorder is clean, On/Off text was added
inside the shared Toggle (right depth), and the null-chronotype select round-trips correctly
with good tests. Six findings survived verification.

## Findings (most severe first)

### 1. [ ] Settings contradicts the new null-chronotype semantics — CONFIRMED
`frontend/src/components/Settings/ProfileSection.tsx:92`

The PR makes `null` ("Not sure — infer it from my data") the recommended stored chronotype, but
ProfileSection still renders a null chronotype as `value={Chronotype.INTERMEDIATE}` (its
`!settings.chronotype` branch) and `CHRONOTYPE_OPTIONS` (lines 18–22) has no "Not sure" entry.
Consequences: (a) a user who accepted the onboarding default opens Settings and sees
**"Intermediate"** as if self-assessed; (b) touching the select PATCHes a concrete value and
there is **no UI path back to null** — a one-way door that permanently overrides the inference
default issue #10 introduced. Backend fully supports clearing it (`UserSettingsUpdate` at
`backend/schemas.py:388` is `Chronotype | None` with `exclude_unset=True` in
`routers/settings.py:59-71`) — only the UI is missing. Flagged independently by 5 of 8 finder
angles.

Severity caveat: today's inference (`backend/services/sleep_timing.py` `_classify_chronotype`)
computes from sleep-midpoint data and never reads `settings.chronotype`, so a stored
self-assessed value does not corrupt analysis output — the displayed value is a lie, but not
yet a poisoned input.

**Fix:** hoist `CHRONOTYPE_UNKNOWN` / `CHRONOTYPE_CHOICES` / `CHRONOTYPE_CHOICE_LABELS` from
`SleepProfileStep.tsx:22-31` into `types/enums.ts` next to `CHRONOTYPE_LABELS`, and use them in
both SleepProfileStep and ProfileSection (also resolves the reuse/altitude finding that the
sentinel is a component-local special case).

### 2. [ ] Toggle renders explicit "Off" for null — violates ADR 003 / CLAUDE.md — CONFIRMED
`frontend/src/components/shared/Toggle.tsx:16`

CLAUDE.md (Data Semantics): "Missing data ≠ negative data. NULL means 'not recorded,' NEVER
'didn't happen.'" `const isOn = checked ?? false` plus `{isOn ? "On" : "Off"}` makes
`checked=null` display the affirmative text **"Off"**. `MealSection.tsx:46-49` passes
`checked={entry.is_last_meal}`, a nullable entry field created as `null` — so an unrecorded
"last meal of the day" now literally reads "Off" (= didn't happen). Pre-PR the null state was
only visually ambiguous (thumb left, `aria-checked=false`); the PR adds the explicit textual
claim, and `Toggle.test.tsx:22` ("treats null as off and toggles to on") codifies it. Stored
data is unchanged (an untouched toggle still submits null) — this is a display-layer violation.
`TrackingSetupStep.tsx:68` (`checked={selected.has(item.key)}`) is a real boolean and
unaffected.

**Fix:** give Toggle a third presentation for null (e.g. "—" / "Not set") — either always, or
via an opt-in prop for nullable entry-field contexts like MealSection.

### 3. [ ] Encrypted-volume instructions are partly inaccurate and lossy — CONFIRMED
`frontend/src/components/Onboarding/DataStorageStep.tsx:34`

The copy says relaunching with `SOMNUS_DB_PATH` now means secrets never touch the default
location — accurate **for the token** (only written at `OuraStep.tsx:23`, later). But by step 2
the default DB already exists and contains user data: `init_db()` runs at backend launch
(`backend/main.py:22`), the wizard's first GET creates the settings row
(`routers/settings.py` `_get_or_create_settings`), and WelcomeStep (step 1) PATCHes **every
age/timezone keystroke immediately** (`OnboardingWizard.tsx` `handleUpdate` → `updateSettings`,
no local buffering). `onboarding_completed` is only set in DoneStep, so following the
instructions restarts onboarding against an empty DB (entered age/timezone lost) and silently
leaves the unencrypted `~/.somnus/somnus.db` containing them on disk.

**Fix (copy-level, matches the PR's stated scope):** tell users to also delete
`~/.somnus/somnus.db` after relaunching, and/or move the SOMNUS_DB_PATH note to the Welcome
screen before any data is persisted. Deeper fix (follow-up issue): buffer onboarding writes
until the storage step is past, or add a real DB-path picker (acknowledged as out of scope in
the PR body).

### 4. [ ] Back-navigation from the Oura step is now untested — CONFIRMED (test-coverage)
`frontend/src/components/Onboarding/OnboardingWizard.test.tsx:93`

The old "can navigate back from Oura step" test was repurposed into "can navigate back from
data storage step" (Get Started → Back → Welcome; never reaches Oura). No remaining unit test
clicks Back past that (lines 68–136 only Get Started/Next/Skip), e2e never presses Back, and
`OuraStep.test.tsx` passes `onBack` but never exercises it. A mis-wired `onBack` on the Oura
step (which should land on the step carrying the SOMNUS_DB_PATH instructions) would pass the
entire suite.

**Fix:** add one wizard test: Get Started → Next → (Oura) Back → assert "Your Data Stays
Local".

### 5. [ ] Hint typography duplicates `.onboarding-hint`; negative margin couples to parent gap — PLAUSIBLE (cleanup)
`frontend/src/components/Onboarding/SleepProfileStep.tsx:34`

Inline `hintStyle` repeats `.onboarding-hint`'s color/font-size
(`OnboardingWizard.css`: `color: var(--color-text-muted); font-size: 0.8rem`), and its
`margin: -0.5rem 0 0` invisibly counteracts the parent flex `gap: 1rem` — retuning the gap
breaks hint alignment with no local clue. Mitigations found during verification: inline styles
are the dominant convention in all seven step files, and `.onboarding-hint` (used once, with
`text-align: center; margin-top: 1rem`) is not a drop-in. Worth consolidating via a modifier
class when convenient, not a merge blocker.

### 6. [ ] Test helper hand-copies the chronotype union — CONFIRMED (minor)
`frontend/src/components/Onboarding/SleepProfileStep.test.tsx:7`

`renderStep(chronotype: "early" | "intermediate" | "late" | null)` re-declares the union
instead of using `Chronotype | null` from `../../types/enums` (already imported from for
CaffeineSensitivity). Drifts silently if a variant is added or renamed.

## Verified non-issues (do not re-flag)
- **Toggle On/Off text pollutes the switch's accessible name**: REFUTED. Accessible-name
  computation for `<button>` does not include associated `<label>` text (HTML-AAM: label-element
  step applies only to input/select/textarea; Testing Library's dom-accessibility-api matches).
  The name doesn't churn and no name-based query can break. Noted in passing: the switch's
  accessible name is empty (button subtree is just the thumb span) — **pre-existing**, not
  introduced by this PR; an `aria-labelledby` on the button would fix it if a11y polish is ever
  scheduled.
- **Duplicated wizard step-order test** ("shows Oura step only after data storage" overlaps the
  first ordering test + full walkthrough): real but trivial duplication of cheap tests; dropped
  as below the action bar.

## Suggested fix order
Findings 1 and 6 are one small PR: hoist the chronotype-choice constants into `types/enums.ts`,
reuse in ProfileSection (+ its "Not sure" option), and type the test helper with
`Chronotype | null`. Finding 2 is a small Toggle change + MealSection prop + test update.
Findings 3 (copy tweak) and 4 (one test) are quick additions to the PR branch. 5 is optional
cleanup. The deeper #8 storage-machinery question (buffer writes / DB-path picker) should
become a follow-up issue rather than expand this PR.

---

Resolution (2026-07-04, fix/onboarding-ux):
1. FIXED — chronotype choice constants hoisted to types/enums.ts;
   ProfileSection now renders "Not sure — infer it from my data" for null
   and PATCHes null back (the one-way door is gone).
2. FIXED — Toggle renders "—" for null (never "Off"); test codifies it.
3. FIXED — storage-step copy now tells users to delete the default DB
   after relaunching; deeper fix (buffered onboarding writes / DB-path
   picker) filed as a follow-up issue.
4. FIXED — wizard test covers Back from the Oura step.
5. SKIPPED — optional style consolidation, per review ("not a merge
   blocker"); inline styles remain the step-file convention.
6. FIXED — test helper typed as Chronotype | null.
