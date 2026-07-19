# Review — PR #64: Resolve T-07 (accept plaintext-at-rest for v0.1 with loud encryption guidance)

- **Branch:** `fix/t07-encryption-at-rest-guidance` → `dev`
- **Reviewed:** 2026-07-06
- **Scope:** `gh pr diff 64` (+135 / −6, 4 files) — README section, THREAT_MODEL T-07 disposition, `DataStorageStep.tsx` security notice, new `DataStorageStep.test.tsx`.
- **Effort:** medium (8 finder angles → verify)

## Overview
Docs/UI-only PR. Adds a non-dismissible security notice to the onboarding *Data
Storage* step and a matching README section, flips threat **T-07** from *Partial*
to *Accepted* for v0.1 with a documented residual + user-guidance condition, and
locks the onboarding copy in with a unit test. No backend / data-flow change.
Palette tokens used (`--color-warning` = `#ff6600` / `#c47a00`) are amber/orange
and comply with ADR 004; Vitest generic style (`Mock<() => void>`, `vi.fn<…>()`)
matches the v4 usage already in `OuraStep.test.tsx`; the test's queries
(`getByRole("alert")`, `getByText(/SOMNUS_DB_PATH=/)`, `/next|continue/i`) all
resolve against the rendered output and `StepNavigation`'s "Back"/"Next" labels.

## Findings

### 1. README.md:88 — VeraCrypt link points at `veracrypt.io`, not the canonical official domain (PLAUSIBLE)
`[VeraCrypt](https://veracrypt.io/)`. The long-standing official VeraCrypt
project site is `https://www.veracrypt.fr/` (IDRIX / Mounir Idrassi), with
release binaries on its linked SourceForge/GitHub. `veracrypt.io` is not the
well-known canonical domain. In a PR whose entire purpose is security guidance,
sending users to download full-disk/volume-encryption software from a
possibly-unofficial domain risks steering them to a look-alike clone.

**Failure scenario:** A user follows the "extra layer" guidance, lands on
`veracrypt.io`, and downloads a VeraCrypt build from a domain the project may
not control — the opposite of the hardening this PR intends.

**Action:** Verify the domain before merge. If `veracrypt.io` is not an official
VeraCrypt property, change the link to `https://www.veracrypt.fr/`. (Network
egress was blocked in the review environment, so the domain could not be
confirmed live — hence PLAUSIBLE rather than CONFIRMED.)

## Minor observations (below the action bar — noted, not blocking)
- **`DataStorageStep.tsx:24` — `role="alert"` on always-present static content.**
  `role="alert"` is an assertive live region intended for dynamically-surfaced
  messages; on mount a screen reader announces it immediately. Arguably
  intentional for a security warning (and the existing `WarningBanner` also uses
  it), but `role="note"`/`role="region"` + `aria-label` would be the more
  conventional choice for static copy. The unit test keys on `getByRole("alert")`,
  so changing it means updating the test.
- **`DataStorageStep.tsx:40` — `⚠` glyph.** On platforms that render U+26A0 as a
  color emoji (yellow/black triangle) this introduces a non-amber hue into
  circadian mode (ADR 004 forbids pure yellow). Platform-dependent and cosmetic;
  a CSS-drawn marker or forcing text-presentation (`⚠︎`) would sidestep it.

## Cleared angles (no finding)
- **Removed-behavior:** the replaced `SOMNUS_DB_PATH` bullet and the old T-07
  "Partial/Residual" prose are re-established with equal-or-stronger content; no
  guidance dropped.
- **Cross-file:** `DataStorageStep` props unchanged; no caller impact.
- **Reuse:** `WarningBanner` is a poor fit here (it takes `string[]`, can't render
  the bold/list/`<code>` markup, and is dismissible vs. the required
  non-dismissible notice) — not re-implementing it is the right call.
- **Conventions:** color tokens comply with ADR 004; inline styles match the
  file's pre-existing pattern; the PR is a permitted Step 9.2/9.3 item under the
  threat-model gate and includes the required "Threat model impact" section.

## Resolution (2026-07-06, commit on `fix/t07-encryption-at-rest-guidance`)

- **Finding 1 (VeraCrypt domain) — RESOLVED, but the premise was outdated.**
  Verified against VeraCrypt's own repo README (`github.com/veracrypt/VeraCrypt`,
  fetched 2026-07-06): the project has **migrated domains** — `veracrypt.jp` is
  now the **primary** official site and `veracrypt.io` is an **official mirror**
  (`"…contact us can be found at: https://veracrypt.jp or https://veracrypt.io
  (mirror)"`). So `veracrypt.io` was *not* a look-alike, and the suggested
  `veracrypt.fr` is itself the **stale** domain (canonical only pre-migration).
  To sidestep the domain-canonicity question entirely and stay robust across any
  future migration, the README link now points at the **official GitHub repo**
  (`github.com/veracrypt/VeraCrypt`), which carries signed releases + download
  links. Lesson logged: verify security-download domains against the project's
  own source of truth, not memory or a search-summary blurb.
- **Minor — `⚠` glyph (ADR 004):** RESOLVED. Forced text presentation via U+FE0E
  (`{"⚠︎ "}`) so the glyph inherits `--color-warning` (amber) instead of a
  platform yellow color-emoji; comment added explaining why.
- **Minor — `role="alert"`:** KEPT (not changed). Deliberate for a security
  notice, consistent with the existing `WarningBanner`, and the reviewer flagged
  it as arguably-intentional / non-blocking; changing it would only churn the
  test for no accessibility gain here.
