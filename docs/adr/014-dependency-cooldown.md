# ADR 014: Dependency-Install Cooldown (Minimum Release Age)

## Status
Accepted — 2026-07-06. Implements part of threat-model **T-13** (PLAN.md Step 9.3).

## Context
Somnus holds maximally sensitive data behind an unauthenticated local API; a compromised dependency (AD3 in `docs/THREAT_MODEL.md`) runs with build/run privileges. The dominant real-world supply-chain attack is **publish-then-yank**: an attacker publishes a malicious version (account takeover / typosquat / maintainer compromise) that is usually detected and removed within hours to a few days. Consuming releases immediately — as `pip install` (floating `>=`) and `npm install` do — maximizes exposure to that window. T-13 flagged the absence of any minimum-release-age ("cooldown") gate as an Open gap.

By 2026 the major package managers ship native release-age gates: npm `min-release-age` (11.10+), pnpm/yarn/bun equivalents, and uv `--exclude-newer` with relative durations (0.9.17+). Somnus uses npm (frontend) and pip (backend).

## Decision
Enforce a **~7-day minimum release age** on dependency installs in both ecosystems.

1. **Frontend (npm):** `min-release-age=7` in `frontend/.npmrc` (value is in **days** — npm semantics; pnpm/bun equivalents use minutes/seconds). It gates `npm install` / `npm update` resolution; frozen `npm ci` (the CI install) is unaffected — correct, since the vetting happens when the lockfile is updated. Because npm < 11.10 **silently ignores** the key, the floor is enforced where the gate actually acts (local lockfile updates): `"engines": {"npm": ">=11.10.0"}` in `frontend/package.json` plus `engine-strict=true` in `.npmrc` make an install on old npm a hard error instead of a silent bypass. CI upgrades npm so `npm ci` passes the same engines check.
2. **Backend (uv):** the cooldown is **committed in `pyproject.toml`** as `[tool.uv.pip] exclude-newer = "7 days"`, so it gates *every* `uv pip install` run anywhere in the repo — CI, `make setup-backend`, and direct invocations alike — not just hand-edited call sites. (An earlier draft claimed uv config accepts only a fixed RFC-3339 timestamp; that is wrong for the pinned uv — relative durations in `[tool.uv.pip]` were verified applied on uv 0.11.26 by observing resolution change with the window.) The install recipe lives once, in `make setup-backend`, which CI runs; outside a virtualenv the recipe passes `--system`, matching the old pip behavior (the README quickstart runs `make setup` with no venv active). uv replaces pip for backend installs — it is pip-compatible and the only backend resolver with a rolling cooldown. When the deferred `uv.lock` lands, add top-level `[tool.uv] exclude-newer` for `uv lock`/`uv sync` as well.
3. **The gating tools are pinned, not floating:** `uv==<UV_VERSION>` in the Makefile and `npm@11.18.0` (exact) in CI. An unpinned `pip install uv` / `npm install -g npm@^11.10` would fetch the newest release with no cooldown — reintroducing the publish-then-yank vector through the very tools that enforce the control. Pins are bumped via reviewed PRs, which is a de facto cooldown for the tools themselves.
4. **Security-fix override:** an urgent patch inside the window can be pulled with `UV_EXCLUDE_NEWER="0 days" make setup-backend` (the env var beats the committed config; an *empty* value is a parse error, use `"0 days"`), an `npm install --before` bypass, or (uv) a per-package `exclude-newer-package`.
5. **Deferred (remaining T-13):** a committed backend lockfile (`uv.lock` via `uv sync`), `npm audit` in CI, and pinning GitHub Actions by SHA — tracked in T-13, not in this change. *Status update (2026-07-09): `npm audit` in CI (lockfile-only, run before `npm ci`) and Action SHA-pinning landed in PR #65.* *Status update (2026-07-15): the backend lockfile landed — `uv.lock` committed, installed via `uv export --frozen` → hash-verified `uv pip install -r` rather than the `uv sync` this ADR anticipated (exact-sync would strip non-project packages from the `--system` env CI uses); freshness enforced in CI by `uv lock --check`; top-level `[tool.uv] exclude-newer` added so lock regeneration is cooldown-gated too, as §2 planned. All T-13 sub-items are now done.*

## Consequences
**Positive:** closes the publish-then-yank window on both ecosystems; native gates are the primary control (Socket PR alerts remain as malware detection); uv also speeds up backend installs.

**Negative / costs:** contributors need uv (the Makefile bootstraps a pinned version) and npm ≥ 11.10 (`engine-strict` fails fast with an upgrade hint; CI provisions it). Legitimate releases lag by ~7 days — mitigated by the override path for security fixes. CI caches `~/.cache/uv` + `~/.cache/pip` (keyed on `pyproject.toml` + `uv.lock` + `Makefile`) so the uv switch doesn't lose the old pip cache's speed. ~~The backend remains unpinned (no lockfile yet): the cooldown bounds *how new* a version may be, not *which exact* one resolves — the lockfile is the deferred complement.~~ *(Resolved 2026-07-15: `uv.lock` committed — see status update above.)*

## References
- `docs/THREAT_MODEL.md` T-13 (supply-chain compromise), adversary AD3
- PLAN.md Step 9.3
- npm `min-release-age` (11.10+); uv `--exclude-newer` / `UV_EXCLUDE_NEWER` (0.9.17+)
