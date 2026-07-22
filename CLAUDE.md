# Somnus — Project Instructions for Claude Code

## Project Overview
Somnus is a locally-run sleep optimization app. Python (FastAPI) backend + React (Vite + TypeScript) frontend + SQLite database.

## Key Documents
- `PLAN.md` — Full feature specification and build order
- `ARCHITECTURE.md` — C4 diagrams (Mermaid), always kept current
- `docs/adr/` — Architecture Decision Records, created for every significant choice

## Critical Rules

### Dependencies
- **Audit before installing**: After any change to pyproject.toml or package.json dependency lists, run `pip-audit` (Python) or `npm audit` (Node) BEFORE running `pip install` or `npm install`. Flag vulnerabilities to the user and get approval before proceeding.
- New dependencies must be justified. Prefer stdlib/existing deps over new ones.

### Data Semantics
- **Missing data ≠ negative data**. NULL means "not recorded," NEVER "didn't happen." See ADR 003.
- All entry fields are optional except `date`.
- Analysis only uses days where a variable was explicitly recorded.

### Security
- No sensitive data (Oura tokens, health data) logged to console or files.
- No raw SQL — all queries through SQLAlchemy ORM.
- CORS restricted to localhost origins only.
- Every PR needs security review per the checklist in PLAN.md.

### Threat Model (standing rule — Step 9 completed and gate lifted 2026-07-09)
- `docs/THREAT_MODEL.md` is the canonical, human-approved statement of what we defend against. Every PR is written and reviewed with it in consideration: which trust boundaries (B1–B5) does the change touch, what attack surface does it add, which threats (T-nn) are affected?
- **Every PR description includes a "Threat model impact" section** — "None" with a one-line justification, or a summary of what changed with the canonical `docs/THREAT_MODEL.md` updated in the same PR. The threat model must never lag the code; review verifies the stated impact against the actual diff, and a missing or wrong impact statement blocks merge.
- Standing invariants (per THREAT_MODEL §8, checked in every review): no new unauthenticated network reachability without Host validation (T-01); state-changing endpoints keep a CORS-non-simple trait and GETs never commit (T-02); no user or external text into an HTML/CSV sink without escaping/neutralization (T-04, T-12); no secrets or health data in logs (T-16); no new dependency without an audit before install (T-13, ADR 014); DB-path and token handling changes get extra scrutiny (T-07, T-08).

### Testing
- 90%+ coverage on new code per commit, 75%+ project-wide floor.
- Critical paths (stats engine, caffeine model, data import): 95%+.
- Backend: pytest. Frontend: Vitest + React Testing Library. E2E: Playwright.
- Tests run with `make test`.

### CI Health
CI on `dev` was red from 2026-02 to 2026-07 because merges never verified it. These rules exist so that never happens again:
- **`dev` CI must stay green.** At the start of any work session, check the latest run: `gh run list --branch dev --limit 1`. If it is red, fixing it preempts all other work — never build features on a broken base.
- **Never merge a PR with failing or pending checks.** Verify with `gh pr checks <number>` immediately before merging. Never use `gh pr merge --admin` to bypass required checks.
- **After merging to `dev`, wait for the post-merge run and confirm it is green** before starting the next task — two individually green PRs can still break `dev` in combination.
- Branch protection on `dev` and `main` requires the `backend (3.11)`, `backend (3.12)`, `frontend`, `security`, `e2e`, and `review-gate` checks. Keep it enabled. If job names in `ci.yml` change, update the protection rule in the same PR.

### Architecture Docs
- ARCHITECTURE.md must be updated in the same commit as any structural change.
- New ADRs created for significant architectural decisions.
- **Docs must describe what the code in the SAME change actually does — never a planned/intended end-state.** A doc (THREAT_MODEL, ADR, PLAN, README) that says a component "now does X" or "becomes Y" requires the code in that same PR to actually make it so; otherwise describe the true current state and file the rest as follow-up. This bit us on #41/PR #95: ADR 015 + THREAT_MODEL were written saying the onboarding step "becomes confirmation," but the frontend copy was left unchanged "to keep scope tight" — so the canonical docs contradicted the shipped UI (a never-lags-the-code violation) and left actively-misleading relocation instructions in the app. Lesson: **frontend/user-facing copy is in-scope for the change that makes its docs true; do not add aspirational doc claims and defer the code.** When a feature changes how an existing flow works, sweep every surface that describes the old flow in the same PR.

### Shipping process (the `ship` skill)
- **Somnus ships via the `ship` skill: https://github.com/kristovatlas/ship (adopted 2026-07-22 at v0.2.0).** It governs milestone shaping, wave planning with touch-set-gated lanes, the review battery, and the autonomous merge gate with its escalation list. Read the skill before shipping work; this section only records repo-specific bindings.
- If `~/.claude/skills/ship/` is missing on this machine, install it: `git clone https://github.com/kristovatlas/ship ~/.claude/skills/ship && git -C ~/.claude/skills/ship checkout v0.2.0`.
- **Merge policy under ship:** a PR merges without human review only when the skill's Phase 4 gate passes and nothing on its escalation list applies (product/UX choices, scope, security posture, non-additive data changes, releases, and any change to `.github/workflows/` or `scripts/review_gate.py`). Escalated PRs merge only after the conversation. The human interface is the wave report, and decisions rather than diffs.
- Somnus bindings for the skill's preflight: base branch `dev`, release branch `main`, tracker = GitHub issues/milestones, review gate = `review-gate` required check per `docs/process/review-gate.md`, merge method = squash to dev / merge-commit for dev→main releases.

### Git Workflow
- Relaxed git flow: feature/* → dev → main.
- `main` always reflects a complete, user-ready release.
- Squash merge to dev. Tag releases on main with semver.
- **All code changes go through feature branches and PRs to dev.** Bug fixes, features, test additions — always `feature/*` or `fix/*` branch → PR to `dev`. Never commit directly to `dev`.
- The former CLAUDE.md direct-to-dev exception is retired: the ruleset requires a PR for every change (admin bypass exists for the human only), so CLAUDE.md changes ride normal PRs like everything else.

### Pull Requests
- Every PR description must include a **Test plan** section with a checkbox list.
- Before submitting a PR, run as many test plan items as possible and **check off the boxes** in the PR description for each verified item.
- **Every PR carries review artifacts** under `docs/reviews/pr-<N>/` per `docs/process/review-gate.md` — the `review-gate` CI check blocks merge without all four validated leg files matching the current diff hash. No exemptions, including docs-only PRs.
- At minimum, always run and verify: backend tests, frontend tests, frontend lint, and frontend build.

### Code Quality
- Python: type hints everywhere, mypy strict, ruff for linting.
- TypeScript: strict mode, eslint + prettier.
- Pydantic for all API boundaries.
- `import datetime as dt` in schemas.py to avoid field name collision with `time` type.

### Display
- Default display mode is "circadian" — amber/red palette only (no blue, green, white, or pure yellow). See ADR 004.

## Common Commands
```bash
make setup     # Install all dependencies
make dev       # Run backend + frontend
make test      # Run all tests
make lint      # Run all linters
make migrate   # Apply DB migrations
```
