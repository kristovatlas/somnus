# Review findings: PR #64 — T-07 encryption-at-rest guidance

- **Status:** RESOLVED (2026-07-06)
- **Reviewed:** 2026-07-06
- **PR:** #64 `fix/t07-encryption-at-rest-guidance` → `dev`
- **Scope:** PR diff only (`README.md`, `docs/THREAT_MODEL.md`, `DataStorageStep.tsx`, `DataStorageStep.test.tsx`).
- **Checks:** `npm test -- DataStorageStep.test.tsx`, `npm run lint`, and `npm run build` passed in `frontend/`.

## Findings

### 1. [x] Do not close T-07 on a T-08 control that is still open — P2 — RESOLVED
`docs/THREAT_MODEL.md:202`

Because this same document still lists T-08 as **Open** and `backend/database.py` still creates the directory/database under the process umask with no `chmod`, the current residual is not limited to users who decline both full-disk encryption and an encrypted volume: on a shared machine with permissive permissions, another OS account can still read the default database. The T-07 disposition should either make the T-08 hardening a prerequisite/implement it in this PR, or phrase the `0600`/`0700` pairing as a future/open dependency so the accepted risk is not recorded as narrower than the code actually enforces.

**Resolution (2026-07-06):** Took the second option (kept T-08 out of scope — it is its own 9.3 item). Reworded the T-07 disposition so the accepted residual is recorded **as the code stands today**: it now explicitly enumerates (1) the declines-both-encryption user *and* (2) the co-resident / other-OS-user read of the default DB, stating that because **T-08 is still Open** this path is **not yet closed**, and that T-08's `0600`/`0700` fix (separate, still-open, not a prerequisite) will only *narrow* residual (2) when it lands. The §7 residual-risk row was updated to match. The doc no longer claims a protection the code doesn't yet enforce.
