# Review findings: PR #44 — Implement dependency-install cooldown (T-13, ADR 014)

- **Status:** RESOLVED — all findings fixed in-PR (2026-07-06, follow-up commit on `fix/t13-dependency-cooldown`). Resolution notes inline below.
- **Reviewed:** 2026-07-06
- **PR:** #44 `fix/t13-dependency-cooldown` → `dev` (`.github/workflows/ci.yml`, `Makefile`, `PLAN.md`, `docs/THREAT_MODEL.md`, `docs/adr/014-dependency-cooldown.md`, `frontend/.npmrc`)
- **Scope:** PR diff only, with package-manager semantics checked against current official npm and uv docs. No files were modified during the audit.
- **Checks:** GitHub CI is green for backend 3.11/3.12, frontend, security, and Socket checks; `git diff --check origin/dev...HEAD` is clean.

The intended direction is sound: `frontend/.npmrc` correctly uses `min-release-age=7`, and backend installs run through `uv pip install` with `UV_EXCLUDE_NEWER="7 days"`. The issues are at the bootstrap boundary and the local setup path. The tools that enforce the policy are installed through floating, uncooled package installs before the policy is active, so the PR's "freshly-published release is not pulled" claim is broader than the actual control. Separately, the Makefile now calls `uv pip install` without selecting a target environment, which breaks the README's fresh-checkout `make setup` workflow unless a virtualenv is already active.

## Findings

### 1. [x] Backend cooldown is bypassed by the floating uv bootstrap install — P1
`.github/workflows/ci.yml:24-30`; `Makefile:6-8`

CI and `make setup-backend` both install uv with plain pip before setting `UV_EXCLUDE_NEWER`:

- `.github/workflows/ci.yml`: `python -m pip install uv`
- `Makefile`: `python -m pip install --quiet uv`

That first install is a floating, latest-version PyPI resolution outside the new release-age gate. A freshly published malicious `uv` release would run in CI or a contributor setup before `UV_EXCLUDE_NEWER="7 days"` can protect the backend dependency install. This undercuts the T-13 claim that backend installs are release-age gated.

**Fix:** pin uv to an exact reviewed version, preferably with hashes or a trusted setup action / installer pinned by digest or commit SHA. If the bootstrap remains floating, document it as a residual T-13 gap instead of marking the backend install cooldown done without qualification.

**Resolution:** uv pinned to `uv==0.11.26` via `UV_VERSION` in the Makefile; CI's backend job now runs `make setup-backend` instead of its own recipe, so the pin applies everywhere. CI's npm upgrade pinned to exact `npm@11.18.0` (was floating `^11.10`). Pin bumps flow through reviewed PRs — a de facto cooldown for the gating tools themselves. Recorded in ADR 014 (Decision 3).

### 2. [x] `setup-backend` does not provide a target environment for `uv pip install` — P1
`Makefile:8`; `README.md` Quick start

The README quick start tells a new contributor to run `make setup` from a fresh checkout. In that state there is normally no activated virtual environment. The changed backend install command now runs:

```make
UV_EXCLUDE_NEWER="7 days" uv pip install -e ".[dev]"
```

`uv pip install` requires an explicit install target: an active virtualenv, a `uv venv`-created project environment, or `--system`. Without one it exits with `No virtual environment found; run uv venv ... or pass --system`, so the documented setup path no longer installs backend dependencies.

CI avoids this by using `uv pip install --system -e ".[dev]"`, but the Make target neither creates a venv nor passes `--system`. Fix by making `setup-backend` select the intended local target environment, preferably by creating/reusing a project `.venv` before the install; if global/system install is intentional, pass `--system` here and update the README to make that expectation explicit.

**Resolution:** `setup-backend` now passes `--system` automatically when no virtualenv is active (`$(if $(VIRTUAL_ENV),,--system)`), matching the old pip behavior and the README quickstart; inside a venv it installs into the venv as before. Verified empirically: `env -u VIRTUAL_ENV make setup-backend` completes on a fresh environment (previously exit 2).

### 3. [x] Frontend CI adds a floating global npm install outside the project cooldown — P2
`.github/workflows/ci.yml:63-68`

The frontend job runs `npm install -g npm@^11.10` before `npm ci`. That global install is not governed by `frontend/.npmrc`, and it resolves a floating npm version from the registry on every CI run. Since the following install is frozen `npm ci`, this step does not meaningfully exercise the lockfile-update path where `min-release-age` matters; it mainly adds a new fresh-package supply-chain path to CI.

**Fix:** remove the npm upgrade from CI if `npm ci` is intentionally unaffected by `min-release-age`, or pin an exact npm version. Enforce npm >= 11.10 in the workflow that updates `package-lock.json` rather than in the frozen install job.

**Resolution:** both halves addressed. The npm ≥ 11.10 floor is now enforced where lockfile updates happen: `"engines": {"npm": ">=11.10.0"}` in `frontend/package.json` + `engine-strict=true` in `frontend/.npmrc` make `npm install` on old npm a hard `EBADENGINE` error instead of a silent cooldown bypass (verified: npm 11.6.2 blocked with upgrade hint; npm 11.18.0 passes with zero unknown-config warnings). The CI upgrade step is kept — `npm ci` must satisfy the same engines check — but pinned to exact `npm@11.18.0` so it no longer floats.

### 4. [x] ADR 014 and the threat model are inaccurate about uv config accepting only timestamps — P3
`docs/adr/014-dependency-cooldown.md:15`; `docs/THREAT_MODEL.md:250`; `PLAN.md:793`

The docs say the relative duration "must be an env var or CLI flag" because uv's `pyproject.toml` / `uv.toml` `exclude-newer` accepts only a fixed RFC-3339 timestamp. Current uv docs say `exclude-newer` accepts RFC 3339 timestamps, friendly durations such as `24 hours` / `1 week` / `30 days`, and ISO 8601 durations, including under `[tool.uv.pip]`.

The env var is still a valid implementation choice, but the ADR records it as mandatory for a reason that is no longer true. That matters because the ADR is the durable design record and the threat model is merge-blocking canonical documentation.

**Fix:** update ADR 014, T-13, and PLAN.md to say env/CLI was chosen for this PR, not required by uv. Consider moving the setting into `[tool.uv.pip]` for discoverability if current uv support is acceptable for the project.

**Resolution:** verified empirically on the pinned uv 0.11.26 — `[tool.uv.pip] exclude-newer = "7 days"` is both accepted and applied (resolution changes with the window: a 3000-day setting resolves 2017–2018-era versions). The cooldown now lives committed in `pyproject.toml`, gating every `uv pip install` in the repo, with `UV_EXCLUDE_NEWER="0 days"` as the documented override (env beats config; empty value is a parse error). ADR 014, THREAT_MODEL T-13, and PLAN 9.3 corrected accordingly.

## Additional fixes applied in the same pass (from the parallel `/review` of this PR)

- **CI backend dependency cache restored:** the PR deleted the `actions/cache` pip step with no uv replacement, leaving both matrix legs to cold-download the full `.[dev]` tree every run. CI now caches `~/.cache/uv` + `~/.cache/pip` keyed on `pyproject.toml` + `Makefile`.
- **Install-recipe duplication removed:** CI's backend job re-encoded the Makefile's install recipe (resolver, extras, cooldown) and could drift; it now runs `make setup-backend`, and the cooldown value itself is single-sourced in `pyproject.toml`.

## Not issues

- `frontend/.npmrc` uses the correct unit: npm `min-release-age` is a number of days, so `min-release-age=7` matches the intended policy.
- `npm ci` being frozen and not the main place where the release-age gate applies is documented correctly; npm's `ci` command installs from the existing lockfile and does not update package manifests or lockfiles.
- The PR keeps the remaining T-13 gaps visible: backend lockfile, `npm audit` in CI, and GitHub Action SHA pinning remain open.

## References

- npm `min-release-age`: <https://docs.npmjs.com/cli/v11/using-npm/config#min-release-age>
- npm `ci`: <https://docs.npmjs.com/cli/v11/commands/npm-ci>
- uv `exclude-newer`: <https://docs.astral.sh/uv/reference/settings/#exclude-newer>
