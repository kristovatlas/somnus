#!/usr/bin/env python3
"""Deterministic review gate (docs/process/review-gate.md).

Verifies that a PR carries current, validated review artifacts for all four
battery legs and that no validated blocking finding (security critical/high,
review P1) remains unfixed. Judges that the judging happened — never the
code itself. Stdlib only; runs identically in CI and locally.

Usage:
  python scripts/review_gate.py --pr 128 --base origin/dev
  python scripts/review_gate.py --hash-only --base origin/dev
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path


def _repo_root() -> Path:
    """The enclosing git repo — NOT derived from __file__: in CI the gate
    runs as a trusted copy of the base branch's script from /tmp against
    the PR checkout as data (PR #128 review, Codex security)."""
    out = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    return Path(out)


REPO_ROOT = _repo_root()
REVIEWS_ROOT = REPO_ROOT / "docs" / "reviews"

# leg file stem -> leg type
REQUIRED_LEGS: dict[str, str] = {
    "claude-code-review": "review",
    "claude-security-review": "security",
    "codex-review": "review",
    "codex-security": "security",
}

SEVERITIES: dict[str, set[str]] = {
    "review": {"P1", "P2", "P3", "nit"},
    "security": {"critical", "high", "medium", "low", "info"},
}

BLOCKING: dict[str, set[str]] = {
    "review": {"P1"},
    "security": {"critical", "high"},
}

REQUIRED_ARTIFACT_FIELDS = {
    "leg",
    "model",
    "reviewed_diff_sha256",
    "reviewed_at",
    "raw_output",
    "findings",
}
REQUIRED_FINDING_FIELDS = {
    "id",
    "summary",
    "severity_claimed",
    "validated",
    "severity_validated",
    "disposition",
}


def compute_diff_hash(base: str) -> str:
    """sha256 of the merge-base diff, excluding the review artifacts
    themselves (so committing artifacts doesn't invalidate the hash they
    attest to).

    Byte-stability across environments (PR #128 review, P2): every config
    knob that changes diff bytes is pinned via -c, external diff drivers are
    disabled, index lines use full object ids (core.abbrev varies with repo
    size), and the RAW BYTES are hashed (no locale-dependent decode).
    """
    if base.startswith("-"):  # option-injection guard (PR #128 review, Low)
        raise SystemExit(f"review-gate: invalid --base ref {base!r}")
    diff = subprocess.run(
        [
            "git",
            "-c",
            "core.quotepath=true",
            "-c",
            "diff.algorithm=myers",
            "-c",
            "diff.noprefix=false",
            "-c",
            "diff.mnemonicprefix=false",
            "diff",
            "--no-color",
            "--no-ext-diff",
            "--no-renames",
            "--full-index",
            "--unified=3",
            f"{base}...HEAD",
            "--",
            ".",
            ":(exclude)docs/reviews",
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        check=True,
    ).stdout
    return hashlib.sha256(diff).hexdigest()


def check_artifact(path: Path, leg: str, leg_type: str, expected_hash: str) -> list[str]:
    """Validate one leg artifact; returns a list of failure messages."""
    fails: list[str] = []
    try:
        data = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        return [f"{path.name}: unreadable or invalid JSON ({exc})"]
    if not isinstance(data, dict):
        return [f"{path.name}: top-level JSON must be an object"]

    missing = REQUIRED_ARTIFACT_FIELDS - set(data)
    if missing:
        fails.append(f"{path.name}: missing fields {sorted(missing)}")
        return fails

    if data["leg"] != leg:
        fails.append(f"{path.name}: leg is {data['leg']!r}, expected {leg!r}")
    if data["reviewed_diff_sha256"] != expected_hash:
        fails.append(
            f"{path.name}: STALE — reviewed_diff_sha256 does not match the "
            f"current code diff. The code changed after this review; re-run "
            f"the leg and re-attest. (artifact {data['reviewed_diff_sha256'][:12]}…, "
            f"current {expected_hash[:12]}…)"
        )
    if not isinstance(data["findings"], list):
        fails.append(f"{path.name}: findings must be a list")
        return fails
    raw = data.get("raw_output")
    if not isinstance(raw, str) or not raw.strip():
        fails.append(
            f"{path.name}: raw_output must be a non-empty string — embed the leg's actual output"
        )
    for field in ("model", "reviewed_at"):
        if not isinstance(data.get(field), str) or not str(data[field]).strip():
            fails.append(f"{path.name}: {field} must be a non-empty string")

    valid_sev = SEVERITIES[leg_type]
    for i, f in enumerate(data["findings"]):
        if not isinstance(f, dict):
            fails.append(f"{path.name} finding[{i}]: must be an object")
            continue
        tag = f"{path.name} finding[{i}]({f.get('id', '?')})"
        missing_f = REQUIRED_FINDING_FIELDS - set(f)
        if missing_f:
            fails.append(f"{tag}: missing fields {sorted(missing_f)}")
            continue
        if not isinstance(f["validated"], bool):
            fails.append(f"{tag}: validated must be true/false")
            continue
        # Unhashable/non-string severities would TypeError at set membership
        # (fail-closed but a traceback, not a diagnostic) — Kristov's Codex
        # pass on PR #128, P3.
        if not isinstance(f["severity_claimed"], str) or not isinstance(
            f["severity_validated"], str
        ):
            fails.append(f"{tag}: severities must be strings")
            continue
        if f["severity_claimed"] not in valid_sev:
            fails.append(
                f"{tag}: severity_claimed {f['severity_claimed']!r} not in "
                f"{sorted(valid_sev)} for a {leg_type} leg"
            )
        if f["severity_validated"] not in valid_sev:
            fails.append(
                f"{tag}: severity_validated {f['severity_validated']!r} not in "
                f"{sorted(valid_sev)} for a {leg_type} leg"
            )
            continue
        if not isinstance(f["disposition"], str) or f["disposition"] not in {
            "fixed",
            "dismissed",
        }:
            fails.append(f"{tag}: disposition must be fixed|dismissed")
            continue
        needs_reason = f["disposition"] == "dismissed" or f["validated"] is False
        if needs_reason and not str(f.get("reason", "")).strip():
            fails.append(f"{tag}: dismissed/unvalidated findings require a reason")
        # The threshold rule.
        if (
            f["validated"] is True
            and f["severity_validated"] in BLOCKING[leg_type]
            and f["disposition"] != "fixed"
        ):
            fails.append(
                f"{tag}: BLOCKING — validated {f['severity_validated']} finding "
                f"is not fixed. Fix it (and re-review) before merge."
            )
    return fails


def _display(path: Path) -> str:
    """Repo-relative when possible; absolute otherwise (e.g. under tests)."""
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def run_gate(pr: int, base: str) -> int:
    expected_hash = compute_diff_hash(base)
    pr_dir = REVIEWS_ROOT / f"pr-{pr}"
    failures: list[str] = []
    if not pr_dir.is_dir():
        failures.append(
            f"missing {_display(pr_dir)}/ — the review battery has not been recorded for PR #{pr}"
        )
    else:
        for leg, leg_type in REQUIRED_LEGS.items():
            path = pr_dir / f"{leg}.json"
            if not path.is_file():
                failures.append(f"missing leg artifact: {_display(path)}")
                continue
            failures.extend(check_artifact(path, leg, leg_type, expected_hash))

    if failures:
        print(f"review-gate: FAIL for PR #{pr} ({len(failures)} problem(s)):")
        for f in failures:
            print(f"  ✗ {f}")
        return 1
    print(f"review-gate: PASS for PR #{pr} — all 4 legs present, current, validated.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pr", type=int, help="PR number (docs/reviews/pr-<N>/)")
    parser.add_argument("--base", default="origin/dev", help="merge-base ref")
    parser.add_argument(
        "--hash-only",
        action="store_true",
        help="print the current reviewed_diff_sha256 and exit",
    )
    args = parser.parse_args()
    if args.hash_only:
        print(compute_diff_hash(args.base))
        return 0
    if args.pr is None:
        parser.error("--pr is required unless --hash-only")
    return run_gate(args.pr, args.base)


if __name__ == "__main__":
    raise SystemExit(main())
