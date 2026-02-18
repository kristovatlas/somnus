"""Tests for sleep timing analysis — chronotype, social jet lag, optimal bedtime."""

import datetime as dt

import numpy as np
import pandas as pd
import pytest

from backend.services.sleep_timing import (
    _classify_chronotype,
    _compute_optimal_bedtime,
    compute_sleep_timing,
)


def _make_timing_df(
    n: int = 30,
    midpoint: float = 27.0,
    bedtime: float = 23.0,
    scores: list[int] | None = None,
    weekend_shift: float = 0.0,
) -> pd.DataFrame:
    """Build a DataFrame with sleep timing data."""
    dates = pd.date_range("2025-01-01", periods=n)
    rows = []
    for i, d in enumerate(dates):
        is_wknd = d.weekday() >= 5
        mid = midpoint + (weekend_shift if is_wknd else 0) + np.random.normal(0, 0.3)
        bt = bedtime + (weekend_shift if is_wknd else 0) + np.random.normal(0, 0.3)
        sc = (scores[i] if scores else 80) + np.random.randint(-5, 5)
        rows.append({
            "sleep_midpoint_hour": mid,
            "bedtime_hour": bt,
            "sleep_score": sc,
            "is_weekend": is_wknd,
        })
    return pd.DataFrame(rows, index=dates)


class TestClassifyChronotype:
    def test_early_bird(self):
        # Midpoint < 26.5 → early
        chrono, conf = _classify_chronotype(26.0, 60)
        assert chrono == "early"

    def test_intermediate(self):
        # 26.5 <= midpoint < 27.5 → intermediate
        chrono, conf = _classify_chronotype(27.0, 30)
        assert chrono == "intermediate"

    def test_night_owl(self):
        # midpoint >= 27.5 → late
        chrono, conf = _classify_chronotype(28.0, 30)
        assert chrono == "late"

    def test_boundary_26_5(self):
        chrono, _ = _classify_chronotype(26.5, 30)
        assert chrono == "intermediate"

    def test_boundary_27_5(self):
        chrono, _ = _classify_chronotype(27.5, 30)
        assert chrono == "late"

    def test_confidence_low(self):
        _, conf = _classify_chronotype(27.0, 20)
        assert conf == "low"

    def test_confidence_moderate(self):
        _, conf = _classify_chronotype(27.0, 30)
        assert conf == "moderate"

    def test_confidence_high(self):
        _, conf = _classify_chronotype(27.0, 60)
        assert conf == "high"


class TestComputeSleepTiming:
    def test_empty_dataframe(self):
        df = pd.DataFrame()
        result = compute_sleep_timing(df)
        assert result["chronotype"] is None
        assert result["n_days"] == 0

    def test_insufficient_data(self):
        df = _make_timing_df(n=10)
        result = compute_sleep_timing(df)
        assert result["chronotype"] is None
        assert result["n_days"] == 10

    def test_early_chronotype(self):
        df = _make_timing_df(n=30, midpoint=25.5)  # Early riser
        result = compute_sleep_timing(df)
        assert result["chronotype"] == "early"
        assert result["n_days"] == 30

    def test_late_chronotype(self):
        df = _make_timing_df(n=30, midpoint=28.5)  # Night owl
        result = compute_sleep_timing(df)
        assert result["chronotype"] == "late"

    def test_social_jet_lag_computed(self):
        df = _make_timing_df(n=60, weekend_shift=1.5)
        result = compute_sleep_timing(df)
        assert result["social_jet_lag_minutes"] is not None
        assert result["social_jet_lag_minutes"] > 0
        assert result["social_jet_lag_rating"] is not None

    def test_social_jet_lag_minimal_shift(self):
        df = _make_timing_df(n=60, weekend_shift=0.0)
        result = compute_sleep_timing(df)
        if result["social_jet_lag_minutes"] is not None:
            assert result["social_jet_lag_minutes"] < 60  # Should be small

    def test_no_social_jet_lag_insufficient_weekends(self):
        # Only 5 days — not enough weekends
        df = _make_timing_df(n=30)
        # Override: all weekdays
        df["is_weekend"] = False
        result = compute_sleep_timing(df)
        assert result["social_jet_lag_minutes"] is None

    def test_optimal_bedtime(self):
        # Create data where high scores cluster around 22:30
        n = 60
        dates = pd.date_range("2025-01-01", periods=n)
        rows = []
        for i, d in enumerate(dates):
            bt = 22.5 + np.random.normal(0, 0.3)
            # Score inversely related to distance from 22.5
            score = 90 - abs(bt - 22.5) * 20 + np.random.normal(0, 2)
            rows.append({
                "sleep_midpoint_hour": 27.0,
                "bedtime_hour": bt,
                "sleep_score": score,
                "is_weekend": d.weekday() >= 5,
            })
        df = pd.DataFrame(rows, index=dates)
        result = compute_sleep_timing(df)
        assert result["optimal_bedtime_start"] is not None
        assert result["optimal_bedtime_end"] is not None
        assert result["optimal_bedtime_start"] < result["optimal_bedtime_end"]


class TestComputeOptimalBedtime:
    def test_insufficient_data(self):
        df = pd.DataFrame({
            "bedtime_hour": [22.5, 23.0],
            "sleep_score": [80, 85],
        })
        start, end = _compute_optimal_bedtime(df)
        assert start is None
        assert end is None

    def test_missing_columns(self):
        df = pd.DataFrame({"other_col": [1, 2, 3]})
        start, end = _compute_optimal_bedtime(df)
        assert start is None
        assert end is None
