"""Age-adjusted sleep stage targets and consistency threshold ratings.

Data from PLAN.md Section 7 (stage targets) and Section 12 (consistency).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class StageTargets:
    """Age-adjusted target ranges for deep and REM sleep."""

    age_group: str
    deep_min_minutes: int
    deep_max_minutes: int
    rem_min_minutes: int
    rem_max_minutes: int


_AGE_BRACKETS: list[tuple[int, int, StageTargets]] = [
    (18, 30, StageTargets("18-30", 75, 100, 90, 120)),
    (31, 50, StageTargets("31-50", 60, 90, 90, 120)),
    (51, 65, StageTargets("51-65", 45, 75, 80, 110)),
    (66, 999, StageTargets("66+", 30, 60, 70, 100)),
]


def get_stage_targets(age: int | None) -> StageTargets | None:
    """Return age-adjusted stage targets, or None if age not set."""
    if age is None:
        return None
    for low, high, targets in _AGE_BRACKETS:
        if low <= age <= high:
            return targets
    return None


def rate_sigma(minutes: float) -> str:
    """Rate bedtime standard deviation (σ)."""
    if minutes < 30:
        return "consistent"
    if minutes <= 60:
        return "somewhat_inconsistent"
    return "erratic"


def rate_delta(minutes: float) -> str:
    """Rate mean offset from typical bedtime (δ)."""
    if minutes < 30:
        return "on_target"
    if minutes <= 60:
        return "drifting"
    return "misaligned"


def rate_drift(minutes: float) -> str:
    """Rate weekday/weekend bedtime drift (Δ)."""
    if minutes < 30:
        return "minimal"
    if minutes <= 60:
        return "moderate"
    return "significant"


def rate_stage_vs_target(avg: float, min_target: int, max_target: int) -> str:
    """Rate a sleep stage average against its target range."""
    if avg < min_target:
        return "below"
    if avg > max_target:
        return "above"
    return "in_range"
