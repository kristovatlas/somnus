"""The review gate itself is load-bearing process infrastructure — test it
like code (docs/process/review-gate.md). Loaded from scripts/ by path."""

import importlib.util
import json
from pathlib import Path
from typing import Any

import pytest

_SPEC = importlib.util.spec_from_file_location(
    "review_gate", Path(__file__).parents[2] / "scripts" / "review_gate.py"
)
assert _SPEC and _SPEC.loader
review_gate = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(review_gate)

HASH = "a" * 64


def artifact(leg: str, findings: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "leg": leg,
        "model": "claude-fable-5",
        "reviewed_diff_sha256": HASH,
        "reviewed_at": "2026-07-20",
        "raw_output": "full leg output here",
        "findings": findings or [],
    }


def finding(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "id": "F1",
        "summary": "a finding",
        "severity_claimed": "P2",
        "validated": True,
        "severity_validated": "P2",
        "disposition": "fixed",
    }
    base.update(overrides)
    return base


def write(tmp_path: Path, leg: str, data: dict[str, Any]) -> Path:
    p = tmp_path / f"{leg}.json"
    p.write_text(json.dumps(data))
    return p


class TestCheckArtifact:
    def test_clean_artifact_passes(self, tmp_path: Path) -> None:
        p = write(tmp_path, "codex-review", artifact("codex-review"))
        assert review_gate.check_artifact(p, "codex-review", "review", HASH) == []

    def test_stale_hash_fails(self, tmp_path: Path) -> None:
        p = write(tmp_path, "codex-review", artifact("codex-review"))
        fails = review_gate.check_artifact(p, "codex-review", "review", "b" * 64)
        assert any("STALE" in f for f in fails)

    def test_validated_p1_not_fixed_blocks(self, tmp_path: Path) -> None:
        f = finding(severity_validated="P1", disposition="dismissed", reason="nah")
        p = write(tmp_path, "codex-review", artifact("codex-review", [f]))
        fails = review_gate.check_artifact(p, "codex-review", "review", HASH)
        assert any("BLOCKING" in m for m in fails)

    def test_validated_high_security_not_fixed_blocks(self, tmp_path: Path) -> None:
        f = finding(
            severity_claimed="high",
            severity_validated="high",
            disposition="dismissed",
            reason="accepted",
        )
        p = write(tmp_path, "codex-security", artifact("codex-security", [f]))
        fails = review_gate.check_artifact(p, "codex-security", "security", HASH)
        assert any("BLOCKING" in m for m in fails)

    def test_validated_p1_fixed_passes(self, tmp_path: Path) -> None:
        f = finding(severity_validated="P1", disposition="fixed")
        p = write(tmp_path, "codex-review", artifact("codex-review", [f]))
        assert review_gate.check_artifact(p, "codex-review", "review", HASH) == []

    def test_unvalidated_finding_needs_reason(self, tmp_path: Path) -> None:
        f = finding(validated=False, reason="")
        p = write(tmp_path, "codex-review", artifact("codex-review", [f]))
        fails = review_gate.check_artifact(p, "codex-review", "review", HASH)
        assert any("require a reason" in m for m in fails)

    def test_dismissed_medium_with_reason_passes(self, tmp_path: Path) -> None:
        f = finding(severity_validated="P2", disposition="dismissed", reason="cosmetic only")
        p = write(tmp_path, "codex-review", artifact("codex-review", [f]))
        assert review_gate.check_artifact(p, "codex-review", "review", HASH) == []

    def test_wrong_severity_enum_for_leg_type(self, tmp_path: Path) -> None:
        f = finding(severity_validated="high")  # security enum on a review leg
        p = write(tmp_path, "codex-review", artifact("codex-review", [f]))
        fails = review_gate.check_artifact(p, "codex-review", "review", HASH)
        assert any("not in" in m for m in fails)

    def test_empty_raw_output_fails(self, tmp_path: Path) -> None:
        a = artifact("codex-review")
        a["raw_output"] = "  "
        p = write(tmp_path, "codex-review", a)
        fails = review_gate.check_artifact(p, "codex-review", "review", HASH)
        assert any("raw_output" in m for m in fails)

    def test_missing_fields_and_bad_json(self, tmp_path: Path) -> None:
        p = tmp_path / "codex-review.json"
        p.write_text("{not json")
        assert review_gate.check_artifact(p, "codex-review", "review", HASH)
        a = artifact("codex-review")
        del a["reviewed_at"]
        p2 = write(tmp_path, "claude-code-review", a)
        fails = review_gate.check_artifact(p2, "claude-code-review", "review", HASH)
        assert any("missing fields" in m for m in fails)


class TestRunGate:
    def test_missing_pr_dir_fails(self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        monkeypatch.setattr(review_gate, "REVIEWS_ROOT", tmp_path)
        monkeypatch.setattr(review_gate, "compute_diff_hash", lambda base: HASH)
        assert review_gate.run_gate(999, "origin/dev") == 1

    def test_missing_one_leg_fails(self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
        monkeypatch.setattr(review_gate, "REVIEWS_ROOT", tmp_path)
        monkeypatch.setattr(review_gate, "compute_diff_hash", lambda base: HASH)
        pr_dir = tmp_path / "pr-7"
        pr_dir.mkdir()
        for leg in ["claude-code-review", "claude-security-review", "codex-review"]:
            write(pr_dir, leg, artifact(leg))  # codex-security omitted
        assert review_gate.run_gate(7, "origin/dev") == 1

    def test_all_four_legs_clean_passes(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        monkeypatch.setattr(review_gate, "REVIEWS_ROOT", tmp_path)
        monkeypatch.setattr(review_gate, "compute_diff_hash", lambda base: HASH)
        pr_dir = tmp_path / "pr-7"
        pr_dir.mkdir()
        for leg in review_gate.REQUIRED_LEGS:
            write(pr_dir, leg, artifact(leg))
        assert review_gate.run_gate(7, "origin/dev") == 0

    def test_hash_is_deterministic_and_ignores_reviews_dir(self) -> None:
        h1 = review_gate.compute_diff_hash("origin/dev")
        h2 = review_gate.compute_diff_hash("origin/dev")
        assert h1 == h2 and len(h1) == 64
