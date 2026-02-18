"""Tests for science/reference_data.py — age targets and threshold ratings."""

from backend.science.reference_data import (
    get_stage_targets,
    rate_delta,
    rate_drift,
    rate_sigma,
    rate_stage_vs_target,
)


# --- get_stage_targets ---


class TestGetStageTargets:
    def test_none_age_returns_none(self) -> None:
        assert get_stage_targets(None) is None

    def test_age_18_bracket(self) -> None:
        t = get_stage_targets(18)
        assert t is not None
        assert t.age_group == "18-30"
        assert t.deep_min_minutes == 75

    def test_age_25_in_first_bracket(self) -> None:
        t = get_stage_targets(25)
        assert t is not None
        assert t.age_group == "18-30"

    def test_age_30_boundary(self) -> None:
        t = get_stage_targets(30)
        assert t is not None
        assert t.age_group == "18-30"

    def test_age_31_second_bracket(self) -> None:
        t = get_stage_targets(31)
        assert t is not None
        assert t.age_group == "31-50"
        assert t.deep_min_minutes == 60
        assert t.deep_max_minutes == 90

    def test_age_50_boundary(self) -> None:
        t = get_stage_targets(50)
        assert t is not None
        assert t.age_group == "31-50"

    def test_age_51_third_bracket(self) -> None:
        t = get_stage_targets(51)
        assert t is not None
        assert t.age_group == "51-65"

    def test_age_66_fourth_bracket(self) -> None:
        t = get_stage_targets(66)
        assert t is not None
        assert t.age_group == "66+"
        assert t.deep_min_minutes == 30
        assert t.rem_max_minutes == 100

    def test_age_90(self) -> None:
        t = get_stage_targets(90)
        assert t is not None
        assert t.age_group == "66+"

    def test_age_below_18_returns_none(self) -> None:
        assert get_stage_targets(10) is None

    def test_age_17_returns_none(self) -> None:
        assert get_stage_targets(17) is None


# --- Rating functions ---


class TestRateSigma:
    def test_consistent(self) -> None:
        assert rate_sigma(15) == "consistent"

    def test_boundary_29(self) -> None:
        assert rate_sigma(29.9) == "consistent"

    def test_somewhat_at_30(self) -> None:
        assert rate_sigma(30) == "somewhat_inconsistent"

    def test_somewhat_at_60(self) -> None:
        assert rate_sigma(60) == "somewhat_inconsistent"

    def test_erratic(self) -> None:
        assert rate_sigma(61) == "erratic"


class TestRateDelta:
    def test_on_target(self) -> None:
        assert rate_delta(10) == "on_target"

    def test_drifting(self) -> None:
        assert rate_delta(45) == "drifting"

    def test_misaligned(self) -> None:
        assert rate_delta(90) == "misaligned"


class TestRateDrift:
    def test_minimal(self) -> None:
        assert rate_drift(15) == "minimal"

    def test_moderate(self) -> None:
        assert rate_drift(45) == "moderate"

    def test_significant(self) -> None:
        assert rate_drift(90) == "significant"


class TestRateStageVsTarget:
    def test_below(self) -> None:
        assert rate_stage_vs_target(40, 60, 90) == "below"

    def test_in_range(self) -> None:
        assert rate_stage_vs_target(75, 60, 90) == "in_range"

    def test_at_min_boundary(self) -> None:
        assert rate_stage_vs_target(60, 60, 90) == "in_range"

    def test_at_max_boundary(self) -> None:
        assert rate_stage_vs_target(90, 60, 90) == "in_range"

    def test_above(self) -> None:
        assert rate_stage_vs_target(95, 60, 90) == "above"
