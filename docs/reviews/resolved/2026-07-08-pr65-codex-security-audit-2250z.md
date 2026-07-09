# PR #65 Codex Security Audit

Date: 2026-07-08
Target: PR #65, `dev...869bd95633ae410f8912de3d5e6df6cbb4dac209`
Scope: diff-focused review of changed source-like files plus CI and lockfile support files

> **Resolution (2026-07-08):** all three findings and the non-reportable candidate are fixed on the PR branch. #1 DB chmod → `a8f6ddf` (file chmod independent + regression test for the parent-failure path). #2 CSV LF → `8a72f95` (`\n` added to `_CSV_FORMULA_TRIGGERS` + LF-payload regression test). #3 meta `frame-ancestors` → `9218780` (directive removed; the missing SPA anti-framing layer is recorded as an explicit T-14 residual in `docs/THREAT_MODEL.md`, which requires a response-header from whatever serves `dist/`). Non-reportable stale-ACTIVE candidate → `8ccf82c`.

## Summary

Codex Security found 3 reportable issues:

| Severity | Finding | Primary file |
| --- | --- | --- |
| Medium | DB file chmod is skipped when parent chmod fails | `backend/database.py` |
| Low | CSV formula neutralization misses LF-prefixed formulas | `backend/routers/export.py` |
| Low | SPA `frame-ancestors` policy is ineffective in a meta CSP | `frontend/vite.config.ts` |

One additional candidate was reproduced but suppressed for security reporting: stale experiments can persist as `ACTIVE` while responses show `COMPLETED`. That is a product correctness issue, not an in-scope security boundary bypass after the PR's CSRF controls.

## Findings

### 1. DB file chmod is skipped when parent chmod fails

Severity: Medium
Confidence: High
Affected lines: `backend/database.py:73-80`, `backend/database.py:91`

`_harden_db_permissions()` wraps both the parent directory chmod and the DB file chmod in one `try` block:

```python
try:
    os.chmod(db_path.parent, 0o700)
    if db_path.exists():
        os.chmod(db_path, 0o600)
except OSError:
    pass
```

If `os.chmod(db_path.parent, 0o700)` fails, the `os.chmod(db_path, 0o600)` call is skipped. This was reproduced with a DB file under `/tmp`: the file remained `0644` after calling `_harden_db_permissions()`.

Impact: for user-configured `SOMNUS_DB_PATH` values under shared or non-owned parent directories, the SQLite DB can remain readable to other OS users. The DB contains sensitive health data and the Oura token.

Recommended fix: split parent and file chmod handling so the DB file chmod is always attempted when the file exists. Add a regression test for a parent chmod failure path.

### 2. CSV formula neutralization misses LF-prefixed formulas

Severity: Low
Confidence: Medium
Affected lines: `backend/routers/export.py:275-277`, `backend/routers/export.py:288-290`, `backend/routers/export.py:301-303`

The new CSV formula trigger list includes `=`, `+`, `-`, `@`, tab, and carriage return, but omits line feed:

```python
_CSV_FORMULA_TRIGGERS = ("=", "+", "-", "@", "\t", "\r")
```

`_neutralize_csv_cell()` only checks `value[0]`, so an LF-prefixed formula such as `\n=HYPERLINK(...)` is returned unchanged. OWASP CSV Injection guidance lists line feed as a formula trigger.

Impact: if a user opens the CSV export in a spreadsheet client that treats LF-prefixed formulas as active, exported attacker-controlled text may execute as a spreadsheet formula.

Recommended fix: add `\n` to `_CSV_FORMULA_TRIGGERS` and add regression tests for LF-prefixed formula payloads. Consider testing leading whitespace behavior for supported spreadsheet clients.

### 3. SPA `frame-ancestors` policy is ineffective in a meta CSP

Severity: Low
Confidence: High
Affected lines: `frontend/vite.config.ts:26`, `frontend/vite.config.ts:31-35`

`spaCspPlugin()` includes:

```ts
"frame-ancestors 'none'",
```

but delivers the CSP through:

```ts
attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
```

Browsers ignore `frame-ancestors` when it is delivered by a meta CSP. The production SPA therefore remains frameable unless the eventual static-file server adds an HTTP `Content-Security-Policy` header or `X-Frame-Options`.

Impact: this leaves the T-14 anti-framing defense incomplete and allows clickjacking or UI-redress attempts against the SPA. Same-origin policy still prevents the embedding page from reading SPA contents, so severity is low.

Recommended fix: deliver `frame-ancestors 'none'` as an HTTP response header, or add `X-Frame-Options: DENY` in the production server. Keep meta CSP only for directives it can enforce.

## Non-Reportable Candidate

### Stale experiments persist `ACTIVE` while responses show `COMPLETED`

The behavior was reproduced in memory:

- Create a past-dated experiment: response status was `completed`, persisted DB status remained `active`.
- Patch the same experiment: response status was `completed`, persisted DB status remained `active`.

This should be fixed as product correctness, but it was suppressed for security reporting because JSON write endpoints are not CORS-simple, the PR's T-01/T-02 controls block the web-attacker path, and direct local unauthenticated mutation is an accepted local-first residual.

## Validation Performed

- Generated and reviewed diff worklist receipts for all in-scope files.
- Ran `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.
- Ran `npm run build`: succeeded and confirmed the production CSP is emitted as a meta tag.
- Reproduced the DB chmod short-circuit with a temporary `/tmp` DB file.
- Reproduced the experiment lifecycle mismatch with in-memory route-function calls.
- Checked CSV neutralizer behavior directly with LF-prefixed formula payloads.

The sealed Codex Security report was generated at:

`/tmp/codex-security-scans/sleep-optimizer/869bd95633ae_20260708T175012Z/report.md`
