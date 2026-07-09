# Review findings: PR #43 — Fix T-01: validate Host header (TrustedHostMiddleware + Vite allowedHosts)

- **Status:** ADDRESSED @ `68b470e` (2026-07-06). All five primary findings + both lower-severity items resolved in the PR; finding 3's *code* fix (copy-from CSRF hardening) is deferred to the T‑02 remediation PR (its threat-model *scoping* is corrected here). See Resolution below. PR is within the gate exception ("PRs ... implementing Step 9 itself" — a Step 9.3 audit fix for T‑01).
- **Reviewed:** 2026-07-06
- **PR:** #43 `fix/t01-host-validation` → `dev` (`backend/config.py`, `backend/main.py`, `backend/tests/conftest.py`, `backend/tests/test_host_validation.py`, `frontend/vite.config.ts`, `docs/THREAT_MODEL.md`)
- **Scope:** The PR diff only. Findings verified against the checked-out branch and the installed dependency versions (Starlette 0.52.1, pydantic-settings 2.13.0, Vite 7.3.1); several were reproduced live in this Codespace.
- **Related:** `2026-07-05-pr42-threat-model.md` — this PR is the first of the Step 9.3 code fixes that review's findings queued (T‑01). Finding #1 of that review (the Vite proxy / `changeOrigin` ingress) is the direct parent of findings **3**, **4**, and **5** below.

The core mitigation is sound: `TrustedHostMiddleware`, added as the outermost middleware, does close the DNS-rebinding **read** path against the unauthenticated `:8000` API — Starlette 0.52.1's ordering, port-stripping, and 400-on-mismatch all behave as the PR claims, and the `conftest.py` `base_url` change safely re-establishes the suite's prior behavior. The issues below are at the edges: a functional crash in the documented escape hatch (#1), a dev-environment breakage that blocks browser dogfooding (#2), and several inaccuracies in the now-authoritative threat model (#3, #4, #5) that the project's currency rule ("the threat model must never lag the code; a ... wrong impact statement blocks merge") treats as merge-blocking. None undermine the central fix.

## Resolution (2026-07-06, commit `68b470e`)

- **#1 (override crash) — Fixed (code).** `config.py` now uses `NoDecode` + a `field_validator`, so `SOMNUS_ALLOWED_HOSTS` / `SOMNUS_CORS_ORIGINS` accept a comma-separated string *or* JSON; `test_config.py` covers both. Doc updated to state the accepted format.
- **#2 (Codespaces broken) — Fixed (code).** `codespaces_hosts()` auto-appends `<name>-8000/-5173.<domain>` to the backend allow-list (`main.py`) and to Vite `allowedHosts` when `CODESPACE_NAME`/`GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN` are set; empty in production.
- **#3 (POST CSRF outside T‑01/T‑02) — Doc fixed; code deferred to T‑02.** T‑02 broadened beyond GETs to CORS-simple requests and now enumerates `POST …/copy-from/…`; T‑01 residual (a) points at it. The endpoint hardening (idempotency / non-simple trait) is the T‑02 fix PR, as scoped.
- **#4 (Vite `allowedHosts` no-op; false doc) — Fixed (doc + config).** T‑01 now credits Vite's built-in host filter for the F1p closure (not the array), notes the loopback entries are redundant, and adds the `--host` LAN caveat.
- **#5 (dropped packaged-build requirement) — Fixed (doc).** Restored as T‑01 residual (b) + a §7 residual-table row; the startup-log-line suggestion is back as an optional note.
- **Lower — IPv6 `[::1]`:** documented as T‑01 residual (d) (unsupported by the Host check; default `127.0.0.1` bind unaffected). **Test cleanup:** accept cases parametrized, docstring fixed.
- **ARCHITECTURE.md (considered, not flagged):** left unchanged per the reviewer's reasoning.

All checks green post-fix: backend 431 tests / 95% coverage, ruff + mypy; frontend 190 tests, lint, build.

## Findings

### 1. [ ] The documented `SOMNUS_ALLOWED_HOSTS` override crashes the backend at import unless the value is JSON — P1
`backend/config.py:17` (`allowed_hosts`); `docs/THREAT_MODEL.md:150` (override claim)

`allowed_hosts: list[str]` sits on a pydantic-settings model with no custom parser, so pydantic **JSON-decodes** the env value for this complex field. The two forms a human would reach for both fail at `Settings()` (module import, `backend/config.py:24`), so uvicorn never starts:

- `SOMNUS_ALLOWED_HOSTS=localhost,127.0.0.1` → `SettingsError: error parsing value for field "allowed_hosts"` (JSONDecodeError underneath)
- `SOMNUS_ALLOWED_HOSTS=myhost.local` → same crash
- only `SOMNUS_ALLOWED_HOSTS='["myhost.local"]'` succeeds

(Reproduced live against pydantic-settings 2.13.0.) The new threat-model text at `:150` advertises "`SOMNUS_ALLOWED_HOSTS` allows overriding for non-default deployments" with no mention of the JSON requirement, and it is documented nowhere else — following the doc as written takes the app down with an opaque traceback. **Fix:** add a `field_validator` that splits a comma-separated string (the conventional allow-list format, à la Django `ALLOWED_HOSTS`), or document the JSON syntax. Note `cors_origins` at `backend/config.py:16` carries the identical latent bug and would benefit from the same validator.

### 2. [ ] Vite `allowedHosts` rejects the GitHub Codespaces forwarded hostname — browser-based dogfooding is broken — P1
`frontend/vite.config.ts:11`; `backend/main.py:42-47` + `backend/config.py:17` (same for direct `:8000` access)

This repo runs in a Codespace (`GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN=app.github.dev`), so the browser-forwarded origin is `https://<name>-5173.app.github.dev`. A live request with that `Host` against the running dev server returned **`403 Blocked request. This host ... is not allowed.`**; `Host: localhost` returns 200. So opening the app via the forwarded `*.app.github.dev` URL (the Ports-panel "Open in Browser" path) leaves the frontend fully broken, and hitting the forwarded `:8000` URL directly 400s the same way. VS Code Desktop / local-browser forwarding maps to `localhost` and still works, so this is **path-dependent** — but browser access is a common way to dogfood a Codespace, and the release-gating context has Kristov actively dogfooding. **Fix:** when `CODESPACE_NAME` / `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN` are set, append `${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}` (and the `:8000` peer) to the allow-lists; or document that only VS Code Desktop `localhost` forwarding is supported.

### 3. [ ] T‑01 flipped to "Mitigated" but a real cross-site POST CSRF write survives, tracked by neither T‑01 nor T‑02 — P1
`docs/THREAT_MODEL.md:143` (T‑01 status), `:152` (T‑02, GET-only); `backend/routers/daily_log.py:118` (`copy-from`)

A cross-site **simple** `POST /api/daily-log/{date}/copy-from/{source_date}` with an empty `application/x-www-form-urlencoded` body was reproduced live: **200, and the target day's entry was destructively overwritten** with a copy of the source day. It is a CORS-simple request (no preflight), and `Host: localhost:8000` passes the new middleware. T‑01's title includes "CSRF" and is now **Mitigated**; its only CSRF residual pointer scopes the gap to "state-changing **GETs** (T‑02)"; T‑02 is GET-only and does not list this POST. So the write falls through the cracks of the authoritative model — ironically, T‑02's own prose already notes that a bodiless POST is a CORS-simple request, but never applies that to this endpoint.

**Severity caveat (do not overstate):** the *Critical* parts of T‑01 remain genuinely closed — cross-origin reads (CORS), rebinding reads (Host check), and controlled-data **injection** (FastAPI's JSON-only content-type gate rejects simple-request bodies with 422) all still hold. The live residual is data-integrity tampering of the user's *own* days — no exfiltration, no token theft, no injection. This is a **doc-scope** defect, not a new Critical hole. **Fix:** widen T‑02 beyond GETs to "state-changing endpoints reachable via CORS-simple requests" and enumerate `copy-from` (address with idempotency / same-site, or explicitly accept), and/or add a POST-CSRF residual line to T‑01 instead of pointing only at GETs.

### 4. [ ] The Vite `allowedHosts` entries are no-ops and the doc's stated mechanism is false; `--host` would expose `/api` to the LAN — P1
`frontend/vite.config.ts:11`; `docs/THREAT_MODEL.md:150`

In Vite 7.3.1, `isHostAllowedInternal` (bundled `host-validation-middleware`) short-circuits `true` for **any** IPv4/IPv6 literal and for `localhost`/`*.localhost` *before* consulting the array, so both configured entries (`localhost`, `127.0.0.1`) add **zero** restriction over Vite's built-ins. The DNS-rebinding proxy path (F1p) *is* closed — but by Vite's built-in hostname filter (a rebound `attacker.com` Host is not an IP literal and not `*.localhost`, so it's rejected), **not** by this array. So the doc's "Vite `server.allowedHosts` ... pinned to the same loopback names" and the asserted equivalence with the backend (which really does 400 `192.168.1.50`) are inaccurate in a doc that must not lag the code. Separately, because IP-literal Hosts always pass, running `npm run dev -- --host` would expose the unauthenticated `/api` proxy to any LAN host — `changeOrigin: true` launders the `Host` to `localhost:8000` past the backend check, so a co-LAN request for `/api/export/sqlite` (health data + plaintext token) would succeed. Not a default-config vuln (Vite binds `localhost` unless `--host`/`server.host` is set) and not a rebinding vector. **Fix:** correct the T‑01 wording to credit Vite's built-in hostname filtering (and note the array is not a loopback pin), and add a `--host` caveat.

### 5. [ ] The T‑01 rewrite silently drops the packaged-build "serve the SPA same-origin" requirement from the authoritative model — P2
`docs/THREAT_MODEL.md:150` (T‑01 mitigation), `:289` (§7 open-items list)

The old T‑01 text required closing the `:5173` ingress via Vite `allowedHosts` *"and/or in the packaged build serve the SPA statically same-origin with the API so no dev proxy exists."* The rewrite keeps the Vite half and drops the packaged-build clause; a full-doc search confirms it is re-recorded nowhere, and T‑01 was removed from the §7 open-items list. Because the Vite leg is **dev-server-only**, a future packaged build (PLAN.md's `main`-is-releasable path, the release-gating context, and the doc's own T‑05 "future packaged build" note all confirm one is coming) could reintroduce a Host-rewriting proxy and reopen F1p while T‑01 still reads "Mitigated." **Fix:** restore it as a T‑01 residual or an explicit accepted-omission. (The old optional "consider a startup log line if a non-loopback Host is ever seen" was also dropped — minor, since it was phrased as a suggestion, but worth a one-liner.)

## Also flagged (lower severity)

- **[ ] IPv6 loopback `[::1]` is rejected and cannot be allowlisted.** Starlette matches via `host.split(":")[0]`, so `Host: [::1]:8000` collapses to `[` and matches nothing; adding `[::1]` to `allowed_hosts` can't help (it also becomes `[`), and the only workarounds (`"["`, `"*"`) defeat the control. **Latent** — the Makefile runs uvicorn on the default `127.0.0.1`, and browsers resolving `localhost`→`::1` still send `Host: localhost`, so nothing 400s today; it bites only under an explicit IPv6 bind (`--host ::1`/`::`) or a direct `http://[::1]:8000` client. Add a doc note that IPv6-literal binds are unsupported, or strip brackets before matching. (`backend/config.py:17`, `backend/main.py:42-47`)
- **[ ] `test_default_localhost_host_accepted` has an inaccurate docstring and duplicates the other accept cases.** The docstring says the Host is "set by the client fixture," but the body overrides it with `headers={"host": "localhost"}`. The three accept tests are copy-paste two-line bodies differing only in the host value, while the reject side already uses `@pytest.mark.parametrize` — folding the accept cases into one parametrized test fixes the docstring and the asymmetry together. (`backend/tests/test_host_validation.py:13-16`)

## Considered, not flagged

- **ARCHITECTURE.md not updated.** `ARCHITECTURE.md:75` describes the entry component's middleware as "CORS config" only and wasn't touched. Not flagged as actionable: no C4 element or relation changed (Host validation is internal config of the existing "Application Entry" component, below the diagram's granularity), the repo has never tracked a later-added middleware as a same-commit structural event (`git log -S` shows CORS text and CORS middleware were born together in the scaffold commit), and PR #42 established that trust-boundary / security-control detail lives in `docs/THREAT_MODEL.md` — which this PR *did* update. Reasonable reviewers could differ; noting for the record.

## Not issues (checked, sound)

- **Core Host-validation mechanism is correct.** Verified against Starlette 0.52.1: `add_middleware` registers in reverse-wrap order, so the middleware added last is outermost and a bad Host is rejected (400) before CORS or routing run; `host.split(":")[0]` strips the port so `localhost:8000` matches `localhost`; the code comment's "added last so it is the outermost middleware" is accurate.
- **`conftest.py` `base_url="http://localhost"` change is safe.** No test references `testserver`, asserts absolute URLs / `Location` headers, or uses cookies, and no other test constructs `TestClient(app)` directly, so pinning the base URL fully re-establishes the suite's prior behavior. (Residual footgun only: a *future* test file that makes its own `TestClient(app)` without `base_url` will get an opaque 400 — worth a conftest comment.)
- **No new attack surface, and the headline read paths stay closed.** CORS remains pinned to `http://localhost:5173`; the middleware adds negligible per-request cost (one `.split(":")` + linear scan over a 2-element list); no logging of sensitive data introduced.
- **Test plan boxes are checked and the PR is within the gate exception** (Step 9 work — a T‑01 fix). CI-green and human-review boxes correctly left unchecked.
