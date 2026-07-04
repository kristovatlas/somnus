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

### Threat Model Gate (temporary — replace when PLAN.md Step 9 completes)
- Agreed 2026-07-04: we code with a threat model. Once the PRs open as of that date (#32, #33, #34, #39) are merged, **do not open any new PRs** until PLAN.md Step 9 is complete: threat model authored (`docs/THREAT_MODEL.md`) → reviewed and approved by Kristov (not authoritative until human-approved) → existing code audited against it, findings fixed or explicitly accepted → practice wired into the PR security checklist.
- Only exceptions during the gate: PRs implementing Step 9 itself, and fixes for red `dev` CI.
- When Step 9 completes, replace this section with the standing rule: every PR is written and reviewed with `docs/THREAT_MODEL.md` in consideration; **every PR description includes a "Threat model impact" section** — "None" with a one-line justification, or a summary of what changed with the canonical `docs/THREAT_MODEL.md` updated in the same PR. The threat model must never lag the code; a missing or wrong impact statement blocks merge.

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
- Branch protection on `dev` and `main` requires the `backend (3.11)`, `backend (3.12)`, `frontend`, and `security` checks. Keep it enabled. If job names in `ci.yml` change, update the protection rule in the same PR.

### Architecture Docs
- ARCHITECTURE.md must be updated in the same commit as any structural change.
- New ADRs created for significant architectural decisions.

### Git Workflow
- Relaxed git flow: feature/* → dev → main.
- `main` always reflects a complete, user-ready release.
- Squash merge to dev. Tag releases on main with semver.
- **All code changes go through feature branches and PRs to dev.** Bug fixes, features, test additions — always `feature/*` or `fix/*` branch → PR to `dev`. Never commit directly to `dev`.
- **Exception:** Changes to `CLAUDE.md` itself may be committed directly to `dev` so all Claude Code sessions see them immediately.

### Pull Requests
- Every PR description must include a **Test plan** section with a checkbox list.
- Before submitting a PR, run as many test plan items as possible and **check off the boxes** in the PR description for each verified item.
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
