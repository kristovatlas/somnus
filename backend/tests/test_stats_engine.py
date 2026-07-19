"""Tests for the statistical analysis engine."""

import datetime as dt
from typing import Any

import numpy as np
import pandas as pd
import pytest
from sqlalchemy.orm import Session

from backend.models import (
    CaffeineEntry,
    DailyLog,
    HabitEntry,
    HabitType,
    NapEntry,
    SleepRecord,
    SunlightEntry,
)
from backend.services.stats_engine import (
    OUTCOME_COLUMNS,
    PREDICTOR_COLUMNS,
    VARIABLE_LABELS,
    compute_correlations,
    compute_regression,
    detect_outliers,
    get_data_status,
    prepare_analysis_dataframe,
)

# --- Helpers ---


def _make_sleep_record(db: Session, date: dt.date, **kwargs: Any) -> SleepRecord:
    defaults = {
        "sleep_score": 80,
        "deep_minutes": 70,
        "rem_minutes": 90,
        "light_minutes": 250,
        "total_sleep_minutes": 410,
        "sleep_efficiency": 0.92,
        "onset_latency_minutes": 10,
        "avg_hrv": 45.0,
        "bedtime": dt.datetime.combine(date - dt.timedelta(days=1), dt.time(22, 30)),
        "wake_time": dt.datetime.combine(date, dt.time(6, 20)),
    }
    defaults.update(kwargs)
    rec = SleepRecord(date=date, **defaults)
    db.add(rec)
    return rec


def _make_daily_log(db: Session, date: dt.date, **kwargs: Any) -> DailyLog:
    log = DailyLog(date=date, **kwargs)
    db.add(log)
    return log


def _seed_correlated_data(db: Session, n: int = 30, positive: bool = True) -> None:
    """Seed n days of perfectly correlated caffeine → sleep_score data."""
    base_date = dt.date(2025, 1, 1)
    for i in range(n):
        d = base_date + dt.timedelta(days=i)
        caffeine_mg = 100 + i * 10
        score = 60 + i if positive else 90 - i

        _make_sleep_record(db, d, sleep_score=score)
        _make_daily_log(db, d)
        db.add(
            CaffeineEntry(
                date=d,
                time=dt.time(8, 0),
                amount_mg=caffeine_mg,
                source="drip_coffee",
            )
        )
    db.commit()


# --- prepare_analysis_dataframe tests ---


class TestPrepareAnalysisDataframe:
    def test_empty_db(self, db: Session) -> None:
        df = prepare_analysis_dataframe(db)
        assert df.empty

    def test_sleep_records_only(self, db: Session) -> None:
        _make_sleep_record(db, dt.date(2025, 1, 1))
        _make_sleep_record(db, dt.date(2025, 1, 2))
        db.commit()

        df = prepare_analysis_dataframe(db)
        assert len(df) == 2
        assert "sleep_score" in df.columns
        assert "bedtime_hour" in df.columns

    def test_daily_logs_only(self, db: Session) -> None:
        """Daily logs without sleep records → empty DataFrame (no outcomes)."""
        _make_daily_log(db, dt.date(2025, 1, 1))
        db.add(
            CaffeineEntry(
                date=dt.date(2025, 1, 1),
                time=dt.time(8, 0),
                amount_mg=200,
                source="espresso",
            )
        )
        db.commit()

        df = prepare_analysis_dataframe(db)
        # No sleep records means nothing to analyze
        assert df.empty

    def test_joined_data(self, db: Session) -> None:
        d = dt.date(2025, 1, 1)
        _make_sleep_record(db, d)
        _make_daily_log(db, d)
        db.add(
            CaffeineEntry(
                date=d,
                time=dt.time(8, 0),
                amount_mg=150,
                source="drip_coffee",
            )
        )
        db.commit()

        df = prepare_analysis_dataframe(db)
        assert len(df) == 1
        assert df.iloc[0]["total_caffeine_mg"] == 150
        assert df.iloc[0]["sleep_score"] == 80

    def test_null_handling_nan_not_zero(self, db: Session) -> None:
        """Missing data should be NaN, never zero (ADR 003)."""
        d = dt.date(2025, 1, 1)
        _make_sleep_record(db, d)
        _make_daily_log(db, d)  # No caffeine entries
        db.commit()

        df = prepare_analysis_dataframe(db)
        assert pd.isna(df.iloc[0]["total_caffeine_mg"])

    def test_bedtime_hour_normalization(self, db: Session) -> None:
        """Bedtime after midnight should be 24+ hours."""
        d = dt.date(2025, 1, 1)
        _make_sleep_record(
            db,
            d,
            bedtime=dt.datetime(2024, 12, 31, 0, 30),  # 12:30 AM
        )
        db.commit()

        df = prepare_analysis_dataframe(db)
        assert df.iloc[0]["bedtime_hour"] == pytest.approx(24.5)

    def test_sleep_midpoint_computed(self, db: Session) -> None:
        """Bedtime 10 PM, wake 6 AM → midpoint should be ~2 AM (26.0 in 24+ space)."""
        d = dt.date(2025, 1, 1)
        _make_sleep_record(
            db,
            d,
            bedtime=dt.datetime(2024, 12, 31, 22, 0),  # 10 PM
            wake_time=dt.datetime(2025, 1, 1, 6, 0),  # 6 AM
        )
        db.commit()

        df = prepare_analysis_dataframe(db)
        # bed_h = 22.0, wake_h = 6.0, since 6.0 < 22.0 → wake_h = 30.0
        # midpoint = (22.0 + 30.0) / 2 = 26.0 (= 2:00 AM)
        assert df.iloc[0]["sleep_midpoint_hour"] == pytest.approx(26.0)

    def test_sleep_midpoint_wake_before_6am(self, db: Session) -> None:
        """Bedtime 11 PM, wake 5 AM → midpoint ~2 AM (26.0)."""
        d = dt.date(2025, 1, 1)
        _make_sleep_record(
            db,
            d,
            bedtime=dt.datetime(2024, 12, 31, 23, 0),
            wake_time=dt.datetime(2025, 1, 1, 5, 0),
        )
        db.commit()

        df = prepare_analysis_dataframe(db)
        # bed_h = 23.0, wake_h = 5.0, since 5.0 < 23.0 → wake_h = 29.0
        # midpoint = (23.0 + 29.0) / 2 = 26.0
        assert df.iloc[0]["sleep_midpoint_hour"] == pytest.approx(26.0)

    def test_sleep_midpoint_late_bedtime_late_wake(self, db: Session) -> None:
        """Bedtime 1 AM, wake 9 AM → midpoint 5 AM (29.0)."""
        d = dt.date(2025, 1, 1)
        _make_sleep_record(
            db,
            d,
            bedtime=dt.datetime(2025, 1, 1, 1, 0),
            wake_time=dt.datetime(2025, 1, 1, 9, 0),
        )
        db.commit()

        df = prepare_analysis_dataframe(db)
        # bed_h = 1.0 → normalized to 25.0 (< 6 shift)
        # wake_h = 9.0, since 9.0 < 25.0 → wake_h = 33.0
        # midpoint = (25.0 + 33.0) / 2 = 29.0 (= 5:00 AM)
        assert df.iloc[0]["sleep_midpoint_hour"] == pytest.approx(29.0)

    def test_sleep_midpoint_typical_scenario(self, db: Session) -> None:
        """Bedtime 10:30 PM, wake 6:30 AM → midpoint 2:30 AM (26.5)."""
        d = dt.date(2025, 1, 1)
        _make_sleep_record(
            db,
            d,
            bedtime=dt.datetime(2024, 12, 31, 22, 30),
            wake_time=dt.datetime(2025, 1, 1, 6, 30),
        )
        db.commit()

        df = prepare_analysis_dataframe(db)
        # bed_h = 22.5, wake_h = 6.5, since 6.5 < 22.5 → wake_h = 30.5
        # midpoint = (22.5 + 30.5) / 2 = 26.5 (= 2:30 AM)
        assert df.iloc[0]["sleep_midpoint_hour"] == pytest.approx(26.5)

    def test_is_weekend_flag(self, db: Session) -> None:
        # 2025-01-04 is a Saturday
        _make_sleep_record(db, dt.date(2025, 1, 4))
        # 2025-01-06 is a Monday
        _make_sleep_record(db, dt.date(2025, 1, 6))
        db.commit()

        df = prepare_analysis_dataframe(db)
        saturday_row = df.loc[dt.date(2025, 1, 4)]
        monday_row = df.loc[dt.date(2025, 1, 6)]
        assert saturday_row["is_weekend"] == True  # noqa: E712
        assert monday_row["is_weekend"] == False  # noqa: E712

    def test_habit_aggregation(self, db: Session) -> None:
        d = dt.date(2025, 1, 1)
        _make_sleep_record(db, d)
        _make_daily_log(db, d)
        db.add(HabitEntry(date=d, habit_type=HabitType.ALCOHOL, time=dt.time(19, 0)))
        db.add(HabitEntry(date=d, habit_type=HabitType.EXERCISE, duration_minutes=45))
        db.add(HabitEntry(date=d, habit_type=HabitType.STRESS_LEVEL, value="7"))
        db.commit()

        df = prepare_analysis_dataframe(db)
        assert df.iloc[0]["alcohol"] == 1.0
        assert df.iloc[0]["exercise_done"] == 1.0
        assert df.iloc[0]["exercise_duration_minutes"] == 45
        assert df.iloc[0]["stress_level"] == 7.0

    def test_rolling_consistency(self, db: Session) -> None:
        """sigma_7d and delta_7d are computed from bedtime_hour rolling window."""
        base = dt.date(2025, 1, 1)
        for i in range(7):
            d = base + dt.timedelta(days=i)
            # Vary bedtime between 22:00 and 22:55
            minute = (i * 8) % 60
            bt = dt.datetime.combine(d - dt.timedelta(days=1), dt.time(22, minute))
            _make_sleep_record(db, d, bedtime=bt)
        db.commit()

        df = prepare_analysis_dataframe(db)
        # After 7 days, rolling window should have values
        assert not pd.isna(df.iloc[-1]["sigma_7d"])

    def test_sunlight_aggregation(self, db: Session) -> None:
        d = dt.date(2025, 1, 1)
        _make_sleep_record(db, d)
        _make_daily_log(db, d)
        db.add(SunlightEntry(date=d, start_time=dt.time(7, 30), duration_minutes=20))
        db.commit()

        df = prepare_analysis_dataframe(db)
        assert df.iloc[0]["sunlight_morning_minutes"] == 20
        assert df.iloc[0]["sunlight_first_hour"] == pytest.approx(7.5)

    def test_nap_aggregation(self, db: Session) -> None:
        d = dt.date(2025, 1, 1)
        _make_sleep_record(db, d)
        _make_daily_log(db, d)
        db.add(NapEntry(date=d, start_time=dt.time(14, 0), duration_minutes=25))
        db.add(NapEntry(date=d, start_time=dt.time(16, 0), duration_minutes=15))
        db.commit()

        df = prepare_analysis_dataframe(db)
        assert df.iloc[0]["nap_total_minutes"] == 40
        assert df.iloc[0]["nap_count"] == 2.0


# --- get_data_status tests ---


class TestGetDataStatus:
    def test_empty_dataframe(self) -> None:
        df = pd.DataFrame()
        status = get_data_status(df)
        assert status["total_sleep_days"] == 0
        assert status["phase_a_unlocked"] is False
        assert status["phase_b_unlocked"] is False
        assert status["phase_c_unlocked"] is False

    def test_insufficient_data(self, db: Session) -> None:
        for i in range(10):
            _make_sleep_record(db, dt.date(2025, 1, 1) + dt.timedelta(days=i))
        db.commit()

        df = prepare_analysis_dataframe(db)
        status = get_data_status(df)
        assert status["total_sleep_days"] == 10
        assert status["phase_a_unlocked"] is False

    def test_phase_a_unlocked(self, db: Session) -> None:
        for i in range(15):
            d = dt.date(2025, 1, 1) + dt.timedelta(days=i)
            _make_sleep_record(db, d)
            _make_daily_log(db, d)
            db.add(CaffeineEntry(date=d, amount_mg=100, source="drip_coffee"))
        db.commit()

        df = prepare_analysis_dataframe(db)
        status = get_data_status(df)
        assert status["phase_a_unlocked"] is True
        assert any(
            v["name"] == "total_caffeine_mg" and v["has_correlations"] for v in status["variables"]
        )

    def test_phase_c_requires_30_bedtime_days(self, db: Session) -> None:
        for i in range(30):
            d = dt.date(2025, 1, 1) + dt.timedelta(days=i)
            _make_sleep_record(db, d)
        db.commit()

        df = prepare_analysis_dataframe(db)
        status = get_data_status(df)
        assert status["phase_c_unlocked"] is True


# --- compute_correlations tests ---


class TestComputeCorrelations:
    def test_empty_dataframe(self) -> None:
        df = pd.DataFrame()
        results, sick = compute_correlations(df)
        assert results == []
        assert sick == 0

    def test_positive_correlation(self, db: Session) -> None:
        _seed_correlated_data(db, n=30, positive=True)
        df = prepare_analysis_dataframe(db)
        results, _ = compute_correlations(df)

        # Find caffeine → sleep_score correlation
        caff_score = [
            r
            for r in results
            if r["predictor"] == "total_caffeine_mg" and r["outcome"] == "sleep_score"
        ]
        assert len(caff_score) == 1
        assert caff_score[0]["pearson_r"] > 0.9  # Near-perfect positive

    def test_negative_correlation(self, db: Session) -> None:
        _seed_correlated_data(db, n=30, positive=False)
        df = prepare_analysis_dataframe(db)
        results, _ = compute_correlations(df)

        caff_score = [
            r
            for r in results
            if r["predictor"] == "total_caffeine_mg" and r["outcome"] == "sleep_score"
        ]
        assert len(caff_score) == 1
        assert caff_score[0]["pearson_r"] < -0.9  # Near-perfect negative

    def test_r_values_in_range(self, db: Session) -> None:
        _seed_correlated_data(db, n=30)
        df = prepare_analysis_dataframe(db)
        results, _ = compute_correlations(df)

        for r in results:
            assert -1.0 <= r["pearson_r"] <= 1.0
            assert -1.0 <= r["spearman_r"] <= 1.0

    def test_insufficient_data_skipped(self, db: Session) -> None:
        """Less than min_days pairs → no results."""
        for i in range(5):
            d = dt.date(2025, 1, 1) + dt.timedelta(days=i)
            _make_sleep_record(db, d)
            _make_daily_log(db, d)
            db.add(CaffeineEntry(date=d, amount_mg=100 + i * 10, source="drip_coffee"))
        db.commit()

        df = prepare_analysis_dataframe(db)
        results, _ = compute_correlations(df, min_days=14)
        # Not enough days for any correlation
        caff_results = [r for r in results if r["predictor"] == "total_caffeine_mg"]
        assert len(caff_results) == 0

    def test_sick_days_excluded(self, db: Session) -> None:
        _seed_correlated_data(db, n=20)
        # Add sick days
        for i in range(20, 25):
            d = dt.date(2025, 1, 1) + dt.timedelta(days=i)
            _make_sleep_record(db, d, sleep_score=30)
            _make_daily_log(db, d, is_sick=True)
            db.add(CaffeineEntry(date=d, amount_mg=0, source="other"))
        db.commit()

        df = prepare_analysis_dataframe(db)
        _, sick_count = compute_correlations(df)
        assert sick_count == 5

    def test_sorted_by_abs_r(self, db: Session) -> None:
        _seed_correlated_data(db, n=30)
        df = prepare_analysis_dataframe(db)
        results, _ = compute_correlations(df)

        if len(results) > 1:
            for i in range(len(results) - 1):
                assert abs(results[i]["pearson_r"]) >= abs(results[i + 1]["pearson_r"])

    def test_confidence_levels(self, db: Session) -> None:
        _seed_correlated_data(db, n=20)
        df = prepare_analysis_dataframe(db)
        results, _ = compute_correlations(df, min_days=14)

        for r in results:
            if r["n_days"] < 30:
                assert r["confidence"] == "low"
            elif r["n_days"] < 50:
                assert r["confidence"] == "moderate"
            else:
                assert r["confidence"] == "high"


# --- detect_outliers tests ---


class TestDetectOutliers:
    def test_empty_dataframe(self) -> None:
        df = pd.DataFrame()
        assert detect_outliers(df) == {}

    def test_no_outliers(self) -> None:
        # Normal-looking data
        data = {"sleep_score": [80, 82, 78, 81, 79, 83, 80, 82, 78, 81]}
        df = pd.DataFrame(data, index=pd.date_range("2025-01-01", periods=10))
        outliers = detect_outliers(df, columns=["sleep_score"])
        assert "sleep_score" not in outliers

    def test_detects_outlier(self) -> None:
        # One extreme value
        scores = [80] * 20 + [200]  # z > 3 for the outlier
        dates = pd.date_range("2025-01-01", periods=21)
        df = pd.DataFrame({"sleep_score": scores}, index=dates)
        outliers = detect_outliers(df, columns=["sleep_score"])
        assert "sleep_score" in outliers
        assert len(outliers["sleep_score"]) == 1

    def test_z_score_math(self) -> None:
        """Manually verify z-score calculation."""
        vals = [10.0] * 50 + [100.0]
        dates = pd.date_range("2025-01-01", periods=51)
        df = pd.DataFrame({"test_col": vals}, index=dates)

        mean = np.mean(vals)
        std = np.std(vals, ddof=1)
        expected_z = (100.0 - mean) / std

        outliers = detect_outliers(df, columns=["test_col"], z_threshold=3.0)
        if expected_z > 3.0:
            assert "test_col" in outliers


# --- compute_regression tests ---


class TestComputeRegression:
    def test_empty_dataframe(self) -> None:
        df = pd.DataFrame()
        assert compute_regression(df, "sleep_score") is None

    def test_insufficient_data(self, db: Session) -> None:
        for i in range(10):
            d = dt.date(2025, 1, 1) + dt.timedelta(days=i)
            _make_sleep_record(db, d)
            _make_daily_log(db, d)
            db.add(CaffeineEntry(date=d, amount_mg=100, source="drip_coffee"))
        db.commit()

        df = prepare_analysis_dataframe(db)
        assert compute_regression(df, "sleep_score", min_days=50) is None

    def test_basic_regression(self, db: Session) -> None:
        """With enough correlated data, regression should return a result."""
        _seed_correlated_data(db, n=60, positive=False)
        df = prepare_analysis_dataframe(db)
        result = compute_regression(df, "sleep_score", min_days=14)

        assert result is not None
        assert result["outcome"] == "sleep_score"
        assert 0 <= result["r_squared"] <= 1.0
        assert len(result["coefficients"]) > 0

    def test_regression_coefficients_have_ci(self, db: Session) -> None:
        _seed_correlated_data(db, n=60)
        df = prepare_analysis_dataframe(db)
        result = compute_regression(df, "sleep_score", min_days=14)

        assert result is not None
        for coef in result["coefficients"]:
            assert "ci_lower" in coef
            assert "ci_upper" in coef
            assert coef["ci_lower"] <= coef["ci_upper"]

    def test_regression_stationarity_check(self, db: Session) -> None:
        _seed_correlated_data(db, n=60)
        df = prepare_analysis_dataframe(db)
        result = compute_regression(df, "sleep_score", min_days=14)

        assert result is not None
        assert isinstance(result["is_stationary"], bool)
        assert isinstance(result["has_autocorrelation"], bool)


# --- Variable labels coverage ---


class TestVariableLabels:
    def test_all_columns_have_labels(self) -> None:
        for col in OUTCOME_COLUMNS + PREDICTOR_COLUMNS:
            assert col in VARIABLE_LABELS, f"Missing label for {col}"
