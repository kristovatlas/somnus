# Review findings: PR #42 — Add threat model (Step 9.1) — DRAFT

- **Status:** DOC FIXES APPLIED to #42 @ `d81c93b` (2026-07-05). Every documentation-accuracy / consistency finding below is now corrected in the PR; the underlying **code** vulnerabilities they describe remain **Open**, tracked for the Step 9.3 audit (T‑01/02/04/05/08/09/12/13/14/17).
- **Reviewed:** 2026-07-05
- **PR:** #42 `feature/threat-model` → `dev` (docs-only: `docs/THREAT_MODEL.md`, `docs/adr/013-threat-model-methodology.md`, `ARCHITECTURE.md` note)
- **Scope:** The PR diff only. CI is green on the PR; the PR is within the gate exception ("PRs implementing Step 9 itself"), and no code/config was smuggled in.
- **Supersedes:** `2026-07-05-threat-model-security-gate.md` (same PR). That file's three findings are carried forward and corroborated here as findings **4**, **5**, and **8(a)**; it can be retired.

The patch is docs-only, but this document becomes the canonical, merge-blocking security artifact and Kristov is being asked to sign off scope, accepted risks, and ratings (Step 9.2). The model is well-structured and grounded in the code, and most `file:line` citations hold. The issues below are substantive: an entire normal-run ingress (the Vite proxy) is unmodeled and defeats the headline fix, the CSRF surface is under-enumerated with a technically-incorrect mitigation, an XSS origin claim is wrong and self-contradicts the matrix, and several dispositions/claims would be approved on inaccurate grounds. Fix these before treating the model as ready for approval.

> **Resolution (2026-07-05, commit `d81c93b`).** The doc-accuracy and consistency fixes below were applied to `docs/THREAT_MODEL.md`, `docs/adr/013`, and `ARCHITECTURE.md` on the PR branch: the Vite proxy ingress is now modeled (§3 diagram + boundaries + a matrix row); T‑04's SPA-origin execution corrected (and the E1 matrix cell); T‑02's enumeration, CORS mechanism, and mitigation fixed; T‑03 and T‑07 given single statuses and the ADR‑009 miscitation removed; the matrix's blank Test-router cells filled and the DoS cells aligned with §4; T‑17 (SQLite torn-copy) added; the by-design third-party-disclosure analysis added (ADR 013 decision 2); `alembic/` added to scope; and Open-Meteo/NREL/Sunlight marked PLANNED in ARCHITECTURE.md so the two docs agree. These correct how the model *describes* the system. The actual code hardening (Host validation + closing the :5173 proxy path, HTML escaping, CSV neutralization, file perms, FK pragma, dependency cooldown, consistent SQLite export, CSP) is the **Step 9.3 audit's** job and remains Open. The Mermaid diagram was reviewed by inspection (no local `mmdc` to machine-validate).

## Findings

### 1. [ ] Model the Vite dev-server proxy (port 5173) — it is a second ingress and defeats the T-01 fix — P1
`docs/THREAT_MODEL.md` §3/§5 and T-01; `frontend/vite.config.ts:8-13`, `frontend/src/api/reports.ts:33,41`, `frontend/src/api/client.ts`

In the normal `make dev` flow the SPA is served at `localhost:5173` and `vite.config.ts` proxies `/api` → `http://localhost:8000` with `changeOrigin: true`. The frontend calls the API (and opens reports) via **relative `/api/...` URLs**, so port 5173 is a second, fully-functional ingress to the crown-jewel assets A1/A2/A3 — including `/api/export/sqlite`. The model never lists 5173 as an element in §3 or the §5 matrix, nor marks it n/a. Every threat scoped to "reach `127.0.0.1:8000`" (T-01/T-02/T-03/T-15) applies equally via 5173.

Worse, `changeOrigin: true` rewrites the `Host` header to `localhost:8000` before proxied requests reach uvicorn, so the proposed `TrustedHostMiddleware` (T-01's headline "single control") would pass **all** traffic arriving through the proxy. Protection of port 5173 then rests entirely on Vite's own `server.allowedHosts` — a dependency-version-dependent control the model neither examines nor pins. As written, T-01 claims to "close the reachability half of T-02 and T-03," but it does not cover the ingress used in every normal run.

### 2. [ ] T-04's XSS runs in the SPA origin (:5173), not "the API's own origin" — and this contradicts the E1 "clean" matrix cell — P1
`docs/THREAT_MODEL.md` T-04 (~line 160); `backend/services/report_service.py:661`, `backend/routers/reports.py:55,68`, `frontend/src/api/reports.ts:33,41`

The sink is real and correctly located: `render_monthly_html` interpolates `factor_label` and `exp.get("hypothesis","")` into an f-string with no escaping (`report_service.py:661`), served `Content-Disposition: inline; text/html`. But T-04 asserts the script "executes in the API's own origin" (`localhost:8000`). Because the report is opened via a **relative** `/api/reports/monthly/export-html` URL through the Vite proxy, the document renders at `http://localhost:5173` — the **SPA origin**, same-origin with both the SPA and (via the proxy) every `/api` endpoint. Impact is unchanged-to-worse, so the High rating stands, but the origin analysis is wrong, and it directly contradicts the §5 matrix cell "**E1 Frontend SPA — Tampering: ✓ clean**": stored XSS in fact executes in the SPA origin. This mis-scopes the fix — a CSP applied only to the `:8000` response, or an `index.html` `<meta>` CSP with E1 marked "covered," would leave the real execution context unprotected.

### 3. [ ] T-02 under-enumerates the state-changing-GET (CSRF) surface — read-path GETs mutate and commit — P1
`docs/THREAT_MODEL.md` T-02 (~line 142); `backend/services/recommender.py:345,414,429`, `backend/routers/settings.py:47-52`

T-02 treats `GET /api/oura/sync` as *the* state-changing GET and names PATCH/PUT as the writes. But several read-path GETs mutate state and `db.commit()`: `GET /api/recommendations` and `GET /api/experiments[/{id}]` auto-complete experiments (`recommender.py:345,414,429`), and `GET /api/settings` creates and commits the singleton settings row (`_get_or_create_settings`, `settings.py:47-52`). These are simple cross-origin GETs — the exact T-02 class — triggerable as pure side effects (e.g. `<img src>`), no rebinding needed. The 9.3 audit uses this enumeration as ground truth, so these go unreviewed. It also contradicts the §2 asset note that analysis outputs (A5) are "not persisted."

### 4. [ ] T-02's proposed mitigation is technically insufficient and its CORS reasoning is wrong — P1
`docs/THREAT_MODEL.md` T-02 (~lines 147-149); `backend/routers/oura.py:38-43`

`/api/oura/sync` takes only query params, no body (`oura.py:38-43`). A bodiless cross-origin **POST is a CORS-*simple* request** sent without preflight, so "make sync a POST (removing it from the simple-GET CSRF surface)" does **not** remove it — and the follow-on "the state-changer is non-simple" is false. Only Host validation, a *required* JSON body, or a *required* custom header actually removes it from the simple-CSRF surface. Separately, the doc attributes PATCH/PUT protection to their "`application/json` content-type forc[ing] a CORS preflight"; the correct reason is that PATCH/PUT are non-simple **methods** and are always preflighted regardless of content-type. The conclusion (they're preflighted) is right, but the stated rule is wrong and will mislead future PR reviews (e.g. approving a form-accepting POST as equivalent to a JSON PATCH). *(Corroborates superseded review finding #1.)*

### 5. [ ] "ARCHITECTURE.md describes Open-Meteo/NREL as planned" is false; this PR ships the two canonical docs divergent — P2
`docs/THREAT_MODEL.md` §3 "Not a live boundary" (~line 83); `ARCHITECTURE.md` new "Security view" note and C4 L1/L2/L3

The model's **code** finding is correct — no weather/solar client exists in `backend/services/` (only `oura_client.py` makes outbound calls). But its claim that "ARCHITECTURE.md describes these as planned" is wrong: ARCHITECTURE.md draws `Rel(somnus, openmeteo, ...)` / `Rel(backend, nrel, ...)` as **current** relations (L1 lines 25-26, L2 lines 55-56) and shows a `Sunlight` component using `httpx` (L3) that does not exist in the code. The PR's new "Security view" note asserts the threat model "is built element-by-element against the containers and data flows below and must be kept in sync with them" — so the sync invariant this PR institutes is violated by the same PR. Fix here: mark those elements planned/unimplemented in ARCHITECTURE.md (or model the boundaries), so the two docs agree on day one. *(Corroborates superseded review finding #3.)*

### 6. [ ] Status-ontology violations on the two highest-stakes threats undermine the sign-off — P2
`docs/THREAT_MODEL.md` T-03 (~line 151), T-07 (~line 183), §7 residual table (~line 261); `docs/adr/013` Decision 5; `docs/adr/009-oura-sync-architecture.md`

ADR 013 Decision 5 requires **exactly one status** per threat. Two consequential breaches:
- **T-03** (unauthenticated full-DB-dump incl. token) carries a compound status "**Partial** / mitigated-by **T-01**" while T-01 is itself **Open** (unbuilt), and §7 books its residual as "**Accepted**." So a threat whose only cited mitigation does not yet exist can read as handled. Additionally, T-03 cites **ADR 009** for "absence of auth is an accepted design choice" — but ADR 009 is about the Oura PAT-vs-OAuth choice; **no ADR records the localhost-API no-auth decision.** The PR explicitly asks Kristov to sign off the unauthenticated-API acceptance — it must not rest on a phantom citation.
- **T-07** (plaintext token + health data at rest — the top asset) has header status "**Partial**" and a body that only *recommends* "Accepted," but the §7 table already records it as "**Accepted** with documented residual," presenting a pending decision as decided. Risk: the plaintext-token residual gets signed off without the explicit human acceptance the ontology requires.

Also reconcile the two canonical docs' definition of **Open**: ADR 013 says "tracked issue or fix"; the doc's §6 legend/§7 say "fix or explicit acceptance."

### 7. [ ] The STRIDE matrix breaks its own coverage guarantee — P2
`docs/THREAT_MODEL.md` §5 (~lines 112-123)

§5 states "Every cell is populated with a threat ID or marked **n/a** with a reason. Empty cells are not permitted" — the property ADR 013 selects STRIDE for. The matrix violates it: the **Test router** row leaves four cells as bare "—" (Spoofing / Info-disclosure / DoS / Elevation). Separately, the matrix scores element labels **E1/E2/E3** and a **"Test router"** element that the §3 decomposition and the Mermaid diagram never define (§3 defines only B1-B5, F1-F5, and the diagram nodes), and it books two "**accepted**" DoS cells (E2, F3) with no `T-nn` and no §7 entry even though §4 declares DoS out of scope. Net effect: the promised 1:1 mapping to the decomposition — and the "omissions are visible" guarantee — does not hold. Fix: fill the dashes with `n/a — <reason>`, define the elements in §3/diagram (or add the test router to the diagram), and reconcile the "accepted" DoS cells with §4.

### 8. [ ] T-08's fix doesn't cover AD2 as defined, and the SQLite export can produce a torn backup — P2
`docs/THREAT_MODEL.md` T-08 (~line 192), §4 AD2; `backend/routers/export.py:239-253`

- **(a)** AD2 is defined to include "a non-privileged **process** on the same machine." The planned T-08 fix (dir `0700`, file `0600`) only stops **other OS accounts** — a process running as the same user reads a `0600` file fine — so "closes the co-resident direct-file path" overstates it. Either narrow AD2 to other OS users, or explicitly note same-user process access remains (and is the realistic malware case). *(Corroborates superseded review finding #2.)*
- **(b)** F4's Tampering cell claims completeness with only T-12, but `GET /api/export/sqlite` byte-copies the **live** DB (`open(db_path,"rb")` + `shutil.copyfileobj`, `export.py:239-253`) with no SQLite backup API, no lock, and no `-wal`/`-journal` handling. A concurrent write (e.g. an Oura sync upserting `SleepRecord`s) yields a torn `.db` the user may later restore from — an integrity threat to asset A3 (their backup) with no `T-nn` and no n/a cell.

## Also flagged (lower severity, still worth fixing before approval)

- **T-13 over-credits supply-chain pinning.** "lockfiles are committed" is true only for the frontend (`package-lock.json`); there is **no Python lockfile** and `pyproject.toml` uses floating `>=` ranges, so CI/`make setup` resolve fresh PyPI releases each run. Adjust the T-13 mitigation text and add Python pinning to the 9.3 fix list. (`docs/THREAT_MODEL.md` ~line 234; `pyproject.toml:7-13`)
- **ADR 013 vs. deliverable — "Mermaid overlays derived from the C4 views."** ADR 013 Decision 7 and PLAN.md Step 9.1 call for overlays *on/derived from* the ARCHITECTURE.md C4 diagrams; the doc ships one standalone `flowchart TB` with its own element set. The "update ARCHITECTURE → regenerate overlay" maintenance story won't hold as described. (`docs/adr/013` Decision 7)
- **ADR 013's LINDDUN substitute was not produced.** Decision 2 justifies skipping LINDDUN by promising "explicit modeling of what third parties (Oura, Open-Meteo, NREL) learn by design." The model contains no such by-design-disclosure analysis (Oura appears only as adversary/target). Add it, or soften the ADR. (`docs/adr/013` Decision 2)
- **Migration code omitted from scope.** The scope line lists `alembic.ini` but not the `alembic/` directory (env.py + migration scripts run directly against the DB), and migrations have no element/flow in the decomposition despite ARCHITECTURE.md naming a migration runner. (`docs/THREAT_MODEL.md` ~line 9)
- **Citation-rot has no maintenance rule.** ~30 hard-coded `file:line` refs are pinned to `dev@67d37f3`, but neither the currency rule nor the per-PR "Threat model impact" statement requires re-verifying them — so `Mitigated (with citation)` statuses quietly hollow out as lines drift. Anchor citations to the reviewed commit and re-verify at each version bump (prefer symbol names where possible). (`docs/THREAT_MODEL.md` ~line 10)
- **§8 duplicates the merge-blocking rule.** The impact-statement rule will also live in CLAUDE.md and the PR checklist after 9.4; §8 keeps a "preview" copy in the one doc that "must never lag." Designate CLAUDE.md as the single source and reduce §8 to a pointer plus the threat-model-owned invariants. (`docs/THREAT_MODEL.md` ~line 274)

## Not issues (checked, sound)

- No code/config/dependency changes smuggled into the docs-only PR; within the gate exception; Test plan present with mandatory boxes checked.
- Verified-clean claims hold: no `eval`/`exec`/`pickle`/`subprocess`; no `Depends(auth)`; frontend has no `dangerouslySetInnerHTML`/`eval` and keeps the token in memory only; no log/`print` call sites in non-test backend (T-16); ruff `S`+`T20` enabled; three frontend runtime deps; TLS verification on for Oura; DB path matches `config.py`.
- ADR 013 is the correct next number; internal doc links resolve; the Mermaid diagram parses.
