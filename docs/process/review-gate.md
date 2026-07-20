# The review gate — deterministic enforcement of the review battery

**What it guarantees:** a PR cannot merge unless all four review legs ran
against the *current* code, every finding was validated, and no validated
high/critical security finding or P1 review finding remains unfixed. The
gate is a dumb, deterministic CI check (`review-gate` job →
`scripts/review_gate.py`, stdlib only) — it does not judge code; it judges
that the judging happened and met thresholds. Same gate for **every** PR,
no exemptions (a docs-only carve-out would be an escape hatch).

**What it cannot guarantee** (accepted, by design): that the artifacts are
*genuine*. It guards against forgetting and threshold-fudging, not
deception. Artifacts are permanent audit records; raw leg output is
embedded so fabrication would be a deliberate act, not drift.

## Artifacts

Each PR commits `docs/reviews/pr-<N>/<leg>.json` for all four legs:

| file | leg type | blocking severities |
|---|---|---|
| `claude-code-review.json` | review | P1 |
| `claude-security-review.json` | security | critical, high |
| `codex-review.json` | review | P1 |
| `codex-security.json` | security | critical, high |

(The Claude combined review used in practice may emit both
`claude-code-review.json` and `claude-security-review.json` from one pass —
each attests its own dimension.)

Schema (all fields required unless noted):

```json
{
  "leg": "claude-code-review",
  "model": "claude-fable-5",
  "reviewed_diff_sha256": "<see Staleness binding>",
  "reviewed_at": "2026-07-20",
  "raw_output": "<the leg's full findings text, embedded>",
  "findings": [
    {
      "id": "F1",
      "summary": "one-line description",
      "severity_claimed": "P2",
      "validated": true,
      "severity_validated": "P2",
      "disposition": "fixed",
      "reason": "required when validated=false or disposition=dismissed"
    }
  ]
}
```

Severity enums — review legs: `P1 | P2 | P3 | nit`; security legs:
`critical | high | medium | low | info`. `findings: []` is valid (clean
leg). `disposition` ∈ `fixed | dismissed`.

## Gate rules (all enforced by `scripts/review_gate.py`)

1. `docs/reviews/pr-<N>/` exists and contains all four leg files, parseable
   against the schema.
2. Every finding carries a validation verdict (`validated` + a
   `severity_validated` from the leg's enum) and a disposition;
   `dismissed` and `validated: false` require a `reason`.
3. **Threshold:** no finding with `validated: true` at a blocking severity
   (security critical/high; review P1) may have any disposition other than
   `fixed`.
4. **Staleness binding:** `reviewed_diff_sha256` must equal
   `sha256(git diff --no-color --no-renames --unified=3 <merge-base>...HEAD
   -- . ':(exclude)docs/reviews')` recomputed by CI. Any code change after
   the reviews invalidates them — which mechanically enforces the
   re-review-after-fix rule: a "fixed" blocking finding can only pass the
   gate via a post-fix re-attestation whose hash matches the fixed code.
   The `docs/reviews/` exclusion lets artifacts be committed without
   changing the hash they attest to.

## Authoring workflow (orchestrator)

1. Open the PR (reserves `<N>`); finish all fix rounds.
2. `python scripts/review_gate.py --hash-only --base origin/dev` → embed
   the hash in each artifact while writing the validation sections.
3. Commit the artifacts (hash unaffected — excluded path).
4. `python scripts/review_gate.py --pr <N> --base origin/dev` locally must
   pass before pushing; CI runs the same command as a required check.

## CI

Job `review-gate` (required check, dev + main): checks out the PR **head**
(not the merge ref — so the merge-base diff matches what the orchestrator
hashed locally), full fetch depth, runs the script with the PR number and
base. Python-only, no dependencies.
