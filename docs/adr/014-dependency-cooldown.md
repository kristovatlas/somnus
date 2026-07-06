# ADR 014: Dependency-Install Cooldown (Minimum Release Age)

## Status
Accepted — 2026-07-06. Implements part of threat-model **T-13** (PLAN.md Step 9.3).

## Context
Somnus holds maximally sensitive data behind an unauthenticated local API; a compromised dependency (AD3 in `docs/THREAT_MODEL.md`) runs with build/run privileges. The dominant real-world supply-chain attack is **publish-then-yank**: an attacker publishes a malicious version (account takeover / typosquat / maintainer compromise) that is usually detected and removed within hours to a few days. Consuming releases immediately — as `pip install` (floating `>=`) and `npm install` do — maximizes exposure to that window. T-13 flagged the absence of any minimum-release-age ("cooldown") gate as an Open gap.

By 2026 the major package managers ship native release-age gates: npm `min-release-age` (11.10+), pnpm/yarn/bun equivalents, and uv `--exclude-newer` with relative durations (0.9.17+). Somnus uses npm (frontend) and pip (backend).

## Decision
Enforce a **~7-day minimum release age** on dependency installs in both ecosystems.

1. **Frontend (npm):** `min-release-age=7` in `frontend/.npmrc`. Honored by npm ≥ 11.10 (silently ignored below), so CI's frontend job upgrades npm. It gates `npm install` / `npm update` resolution; frozen `npm ci` (the CI install) is unaffected — correct, since the vetting happens when the lockfile is updated.
2. **Backend (uv):** install via `uv pip install` with `UV_EXCLUDE_NEWER="7 days"` in CI and `make setup-backend`. uv replaces pip for backend installs — it is pip-compatible and the only backend resolver with a rolling cooldown. **The relative duration must be an env var or CLI flag:** uv's `pyproject.toml` / `uv.toml` `exclude-newer` accepts only a fixed RFC-3339 timestamp, so a committed relative `"7 days"` there is a parse error.
3. **Security-fix override:** an urgent patch inside the window can be pulled by unsetting the env var (`UV_EXCLUDE_NEWER=`), an `npm install --before` bypass, or (uv) a per-package `exclude-newer-package = { pkg = false }`.
4. **Deferred (remaining T-13):** a committed backend lockfile (`uv.lock` via `uv sync`), `npm audit` in CI, and pinning GitHub Actions by SHA — tracked in T-13, not in this change.

## Consequences
**Positive:** closes the publish-then-yank window on both ecosystems; native gates are the primary control (Socket PR alerts remain as malware detection); uv also speeds up backend installs.

**Negative / costs:** contributors need uv and npm ≥ 11.10 (CI provisions both; the Makefile bootstraps uv). Legitimate releases lag by ~7 days — mitigated by the override path for security fixes. The uv cooldown lives in env/CLI rather than a committed file, so it is less discoverable than the npm `.npmrc`; this ADR + the Makefile + CI encode it. The backend remains unpinned (no lockfile yet): the cooldown bounds *how new* a version may be, not *which exact* one resolves — the lockfile is the deferred complement.

## References
- `docs/THREAT_MODEL.md` T-13 (supply-chain compromise), adversary AD3
- PLAN.md Step 9.3
- npm `min-release-age` (11.10+); uv `--exclude-newer` / `UV_EXCLUDE_NEWER` (0.9.17+)
