# Review — PR #67: Step 10 release DoD + acceptance checklist (4-reviewer ship pass)

- **Status:** RESOLVED 2026-07-09 — all 20 findings fixed in `1c92248`; deferred code-level realities tracked as issues #68 (milestone blocker), #69, #70 + correcting notes on #48/#49/#59
- **Reviewed:** 2026-07-09
- **PR:** #67 `feature/step10-release-dod` → `dev` — docs-only, +228 (PLAN.md Step 10 + docs/releases/v0.1.0-acceptance.md)
- **Method:** four independent reviewers. (1) Claude /security-review (identification sub-task + verification). (2) Claude /code-review at max effort — since the diff is documentation whose correctness surface is factual accuracy, the finder angles were adapted to claim-verification: 5 parallel finders each auditing a slice of the checklist's ~120 claims against code and GitHub state, a 6-candidate batch verifier, and a fresh gap-sweep; every reported finding verified CONFIRMED with file:line evidence, two reproduced by execution. (3) Codex security-diff-scan (gpt-5.5, xhigh). (4) Codex code review (gpt-5.5, xhigh). No model downgrades anywhere in the run.
- **Security verdict (reviewers 1+3, concordant):** no findings — no secrets/PII in the added text, no instruction that weakens a THREAT_MODEL.md control, no executable wiring of the markdown; the deliberate `<script>`/`=HYPERLINK` strings are acceptance-test payloads whose pass criterion is that existing controls hold.

## Findings (all CONFIRMED; fixed in `1c92248` unless noted)

| # | Finding | Source(s) |
|---|---------|-----------|
| 1 | **Alembic upgrade path broken beyond #49** — `alembic.ini`'s `%(SOMNUS_DB_PATH)s` crashes every `alembic upgrade head`/`make migrate` at configparser interpolation (reproduced), making #49's documented dup-column failure unreachable; and with no baseline migration (001 presumes an existing schema) an empty-DB upgrade can never pass (reproduced). Checklist :23/:165 + PLAN 10.5 rewritten; code bugs filed as **#68** (v0.1.0 milestone, blocker-class) | Claude A + orchestrator repro |
| 2 | **T-04 spot-check vacuous** — daily-log notes and supplement names never render in report HTML (weekly top factors = fixed labels; monthly tags = hardcoded strings; `log.notes` unreferenced in report_service.py); rewritten to target the experiment hypothesis (the only rendered user free-text) in the monthly export, plus a payload-absent assertion | Codex review + Claude D + verifier |
| 3 | **Copy-day misdescribed** — the copy POST destructively replaces the target day server-side immediately (by design per T-02), not "until Save"; default/max are viewed-date-relative | Claude C + verifier |
| 4 | **`cd somnus` complaint false** — canonical repo is `kristovatlas/somnus` (old name 302s); a README-literal clone yields `somnus/`. Checklist :22/:53 + PLAN 10.2 corrected; issue #48 annotated so the wrong "fix" doesn't ship | Claude E |
| 5 | **0.C triage omitted open issues #11/#17/#23/#40** (#11 even matches 0.C's own stale-open pattern via PR #34) — added | Claude E |
| 6 | **#59's "(PLAN §4)" citation fabricated** — PLAN specifies no dismiss feature; reclassified as net-new feature request; noted on #59 | Claude sweep |
| 7 | **Tracking-setup persistence misdescribed** — the localStorage key IS read back (by the step itself), survives `~/.somnus` wipes (breaking the "all ON" fresh-install expectation), and flips don't survive Back; #47 bullet, line-68 box, and the Part-1 fresh-env spec corrected | Claude B + sweep, Codex review |
| 8 | **PLAN 10.3 "sync without manual intervention"** contradicted the checklist's manual Sync-Now flow and unbuilt #57 — aligned | Codex review |
| 9 | **"Full JSON" overstated** — export JSON omits settings, panels (making `panel_id`s uninterpretable), and experiments; scoped, pointing at the sqlite export as the only full backup | Codex review + verifier |
| 10 | **#16 presented as an outstanding blocker-class concern** though closed 2026-07-06 — past-tensed as the stale-open archetype | Claude sweep |
| 11 | **"Phase pills turn green"** contradicted ADR-004 and the checklist's own Part-10 no-green check — restated as unlocked/success styling (amber) | Claude D |
| 12 | **Stock router error page misdescribed twice** — 404s render react-router v7's "Unexpected Application Error!" page (not an "empty shell") and log a console error tripping the adjacent hygiene item; #51's "render errors white-screen" equally false (built-in boundary shows the same stock page) | Claude D + sweep |
| 13 | **"Shows as completed in history"** — no experiment-history UI exists (`getExperiments()` never called); box now checks via `GET /api/experiments` and names the visibility gap as a decide-item | Codex review + Claude D + verifier |
| 14 | **Sync status UI overstated** — "Last sync" never refreshes without remount; background (onboarding) syncs can never produce a result line; corrected at :66/:110; UX gap filed as **#69** (backlog) | Claude B + Codex review |
| 15 | **Sunlight "notes"** — no such input exists (schema-only field); corrected; gap filed as **#70** (backlog) | Claude C + verifier |

(15 rows = 20 raw findings after merging same-mechanism pairs: copy-day ×2, router-error-page ×2, sync-UI ×2, tracking-persistence ×2, alembic ×2.)

## Verified clean (for the record)
Every quoted UI string, numeric range/unit, localStorage key, route, count, §-reference, Makefile target (incl. `make test-all` → Playwright), coverage floor, e2e spec list, milestone membership (20 issues), issue-title cross-reference, PR/commit citation, and close-date in the added text was checked and — beyond the 20 items above — verified accurate.

## Deferred (repo convention: GitHub issues, per PLAN 10.1/10.4, in place of a DEFERRED.md)
- **#68** — alembic ini interpolation crash + missing baseline migration (v0.1.0 milestone; blocker-class under 10.4)
- **#69** — Oura sync-status UI staleness (post-0.1 backlog)
- **#70** — sunlight notes field UI-unreachable (post-0.1 backlog)
- For Kristov (no unilateral action taken): whether copy-day's pre-Save destructive persistence is acceptable for 0.1; whether completed/abandoned experiments being invisible in the UI needs its own issue; #59's own issue body still carries the spurious §4 citation (noted in a comment there).
