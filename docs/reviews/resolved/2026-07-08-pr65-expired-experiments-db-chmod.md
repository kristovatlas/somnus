# Review findings: PR #65 expired experiments and DB chmod hardening

- **Status:** RESOLVED 2026-07-08 — both findings fixed on the PR branch
- **Resolution:** #1 → `8ccf82c` (`_get_active_experiment` excludes rows past `end_date`; regression tests cover active_experiment=None plus a successful new create that persists the stale row COMPLETED). #2 → `a8f6ddf` (file chmod runs independently and unconditionally; the 0700 directory chmod is limited to the default `~/.somnus`; tests cover the failed-parent-chmod and custom-path cases).
- **Reviewed:** 2026-07-08
- **PR:** #65 `fix/step9.3-remaining-threats` -> `dev`
- **Scope:** Follow-up review of the recommendations active-experiment read path and T-08 database permission hardening.

The patch removes read-time experiment completion and adds best-effort database permission hardening. Both changes are directionally right, but there are two regressions to fix before treating the PR as correct: expired experiments can still be returned as the active experiment, and a failed parent-directory chmod can prevent the more important database-file chmod from running.

## Findings

### 1. [x] Stop returning expired experiments as active - P2
`backend/services/recommender.py:353`

`_get_active_experiment()` queries the first row whose stored status is `ACTIVE` and returns `_build_experiment_out()` for it. `_build_experiment_out()` computes an effective `COMPLETED` status when `experiment.end_date < today`, but the object is still returned as `active_experiment`.

That creates a UI deadlock:

- `RecommendationsPage` treats any non-null `active_experiment` as blocking new experiment starts.
- `ExperimentTracker` only renders active-experiment actions when the effective status is `"active"`.
- A past-due row therefore disables all "Start experiment" actions while also hiding the controls that would clear the finished experiment.

Pre-PR, the first read auto-completed the stale row and a later recommendations read returned no active experiment. After this patch, `complete_stale_experiments()` only runs on write paths such as create, but the UI cannot reach that create path once `active_experiment` is non-null.

**Fix:** filter expired rows out in `_get_active_experiment()`, or return `None` when the effective status would be completed. Add a regression test for a stored `ACTIVE` experiment with `end_date` before today: recommendations should return `active_experiment = None`, and starting a new experiment should still be possible.

### 2. [x] Harden the DB file even when parent chmod fails - P2
`backend/database.py:62`

`_harden_db_permissions()` wraps the parent-directory chmod and file chmod in a single `try` block:

```python
try:
    os.chmod(db_path.parent, 0o700)
    if db_path.exists():
        os.chmod(db_path, 0o600)
except OSError:
    pass
```

If `SOMNUS_DB_PATH` points into a directory the process cannot chmod, such as `/tmp/somnus.db`, the parent chmod can raise before the file chmod runs. The app may still own the database file, so `0600` could have succeeded, but under a permissive umask the file can remain group- or world-readable.

**Fix:** handle the parent and file chmod attempts independently. The file chmod should run whenever the file exists, even if hardening the parent directory fails. Tests should cover a custom path where parent chmod raises while file chmod succeeds.

## Recommendation

Fix both before merge. The first is a user-facing workflow regression, and the second weakens the T-08 hardening on supported custom database paths.
