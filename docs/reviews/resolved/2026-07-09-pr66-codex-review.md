# Review findings: PR #66 — Step 9.4 gate lift

- **Status:** RESOLVED 2026-07-09 — all 3 findings fixed on the PR branch
- **Resolution:** #1 → `a5ee69d` (T-02 invariant added to the canonical §8 list). #2 → `fde6d43` (banner reworded to "under `docs/reviews/` (resolved findings archived in `resolved/`)") + the review-records commit in this PR (uncommitted #42/#43 records committed, #44/#64 records archived — same finding as the author review's #2). #3 → `a5ee69d` (dated status note in ADR 014's deferred list: npm-audit-in-CI + SHA-pinning landed in #65, lockfile still deferred).
- **Reviewed:** 2026-07-09
- **PR:** #66 `fix/step9.4-lift-gate` → `dev`
- **Scope:** docs-only diff (`CLAUDE.md`, `PLAN.md`, `docs/THREAT_MODEL.md`)

## Findings

### 1. [P2] Add the T-02 invariant to THREAT_MODEL §8

`docs/THREAT_MODEL.md:303`

Now that this section is declared the standing practice and both CLAUDE/PLAN point reviewers back to THREAT_MODEL §8, the invariant list below still omits the new T-02 CSRF guard added elsewhere in this PR (`GET`s never commit; state-changing endpoints remain CORS-non-simple). A reviewer using the canonical threat model directly would miss that regression check, so §8 should be updated alongside the checklist.

### 2. [P3] Point the completion banner at the committed review records

`PLAN.md:778`

The new completion banner says the Step 9 review records live in `docs/reviews/resolved/`, but in the PR tree the committed #44/#64 records are under `docs/reviews/` and the #42/#43 records are not committed. Anyone auditing Step 9.3 from this banner will miss part of the evidence, so either move/commit the records or describe the location as `docs/reviews/` (with resolved findings archived below it).

### 3. [P3] Keep ADR 014 in sync with the new T-13 status

`PLAN.md:795`

This line now says the npm audit and Action SHA-pinning T-13 sub-items were completed in PR #65, but it still cites ADR 014, whose deferred list continues to include those same two items. After merge, contributors following PLAN versus ADR 014 get conflicting supply-chain status, so update ADR 014 in this PR or avoid citing it as current status.
