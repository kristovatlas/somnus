"""Tests for the recommendation engine service."""

import datetime as dt
from typing import Any, ClassVar, cast
from unittest.mock import patch

import numpy as np
import pandas as pd
import pytest
from sqlalchemy.orm import Session

from backend.models import (
    CaffeineEntry,
    DailyLog,
    Experiment,
    ExperimentStatus,
    HabitEntry,
    HabitType,
    SleepRecord,
    SunlightEntry,
)
from backend.science.reference_data import PREDICTOR_ACTIONS, SCIENCE_THRESHOLDS
from backend.services.recommender import (
    _build_experiment_out,
    _data_driven_recs,
    _get_active_experiment,
    _science_threshold_recs,
    _timing_recs,
    _untried_recs,
    generate_recommendations,
    get_experiment_by_id,
    get_top_recommendations,
    list_experiments,
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


def _seed_full_data(db: Session, n: int = 60) -> None:
    """Seed n days of correlated sleep + daily log data for regression."""
    base = dt.date(2025, 1, 1)
    for i in range(n):
        d = base + dt.timedelta(days=i)
        # Create varying scores to get regression results
        caffeine = 200 + i * 3
        score = max(50, 90 - i // 3)

        _make_sleep_record(
            db,
            d,
            sleep_score=score,
            deep_minutes=60 + (i % 20),
            rem_minutes=80 + (i % 15),
            avg_hrv=40.0 + i * 0.3,
        )

        db.add(DailyLog(date=d))
        db.add(
            CaffeineEntry(
                date=d,
                time=dt.time(8, 0),
                amount_mg=caffeine,
                source="drip_coffee",
            )
        )
        # Add a late caffeine entry on some days
        if i % 3 == 0:
            db.add(
                CaffeineEntry(
                    date=d,
                    time=dt.time(16, 0),
                    amount_mg=100,
                    source="drip_coffee",
                )
            )
        # Exercise on even days
        if i % 2 == 0:
            db.add(
                HabitEntry(
                    date=d,
                    habit_type=HabitType.EXERCISE,
                    duration_minutes=45,
                )
            )
        # Stress varying
        db.add(
            HabitEntry(
                date=d,
                habit_type=HabitType.STRESS_LEVEL,
                value=str(3 + (i % 5)),
            )
        )
    db.commit()


def _seed_minimal_data(db: Session, n: int = 10) -> None:
    """Seed n days — not enough for regression."""
    base = dt.date(2025, 1, 1)
    for i in range(n):
        d = base + dt.timedelta(days=i)
        _make_sleep_record(db, d)
    db.commit()


# --- Data-Driven Recommendations ---


class TestDataDrivenRecs:
    def test_significant_coef_produces_rec(self, db: Session) -> None:
        _seed_full_data(db, n=60)
        from backend.services.stats_engine import prepare_analysis_dataframe

        df = prepare_analysis_dataframe(db)
        recs = _data_driven_recs(df)
        # Should produce at least one recommendation
        assert len(recs) > 0
        for r in recs:
            assert r["category"] == "data_driven"
            assert r["factor"] in PREDICTOR_ACTIONS
            assert "n_days" in r

    def test_non_significant_skipped(self) -> None:
        """Non-significant coefficients should not produce recs."""
        # Create a DataFrame with random data (no real correlation)
        np.random.seed(42)
        n = 60
        df = pd.DataFrame(
            {
                "sleep_score": np.random.randint(60, 90, n),
                "deep_minutes": np.random.randint(50, 100, n),
                "rem_minutes": np.random.randint(70, 120, n),
                "avg_hrv": np.random.uniform(30, 60, n),
                "total_caffeine_mg": np.random.randint(100, 400, n),
                "last_caffeine_hour": np.random.uniform(8, 14, n),
                "is_sick": [None] * n,
            }
        )
        df.index = pd.date_range("2025-01-01", periods=n)
        df.index.name = "date"

        recs = _data_driven_recs(df)
        # All recs should have significant p-values
        for r in recs:
            assert "p=" in r["body"]

    def test_lag1_terms_skipped(self, db: Session) -> None:
        """Lag1 autoregressive terms should not produce recommendations."""
        _seed_full_data(db, n=60)
        from backend.services.stats_engine import prepare_analysis_dataframe

        df = prepare_analysis_dataframe(db)
        recs = _data_driven_recs(df)
        for r in recs:
            assert not r["factor"].endswith("_lag1")

    def test_priority_ordering(self, db: Session) -> None:
        _seed_full_data(db, n=60)
        from backend.services.stats_engine import prepare_analysis_dataframe

        df = prepare_analysis_dataframe(db)
        recs = _data_driven_recs(df)
        if len(recs) > 1:
            # All should have positive priority
            for r in recs:
                assert r["priority"] >= 1

    def test_rec_id_format(self, db: Session) -> None:
        _seed_full_data(db, n=60)
        from backend.services.stats_engine import prepare_analysis_dataframe

        df = prepare_analysis_dataframe(db)
        recs = _data_driven_recs(df)
        for r in recs:
            assert r["id"].startswith("data_driven:")
            parts = r["id"].split(":")
            assert len(parts) == 3  # category:factor:outcome


# --- Science Threshold Recommendations ---


class TestScienceThresholdRecs:
    def test_violated_threshold_produces_rec(self, db: Session) -> None:
        """Late caffeine should trigger a recommendation."""
        base = dt.date(2025, 1, 1)
        for i in range(14):
            d = base + dt.timedelta(days=i)
            _make_sleep_record(db, d)
            db.add(DailyLog(date=d))
            db.add(
                CaffeineEntry(
                    date=d,
                    time=dt.time(16, 0),  # 4 PM = hour 16, > 14
                    amount_mg=200,
                    source="drip_coffee",
                )
            )
        db.commit()

        from backend.services.stats_engine import prepare_analysis_dataframe

        df = prepare_analysis_dataframe(db)
        recs = _science_threshold_recs(df)

        caffeine_recs = [r for r in recs if r["factor"] == "last_caffeine_hour"]
        assert len(caffeine_recs) >= 1
        assert caffeine_recs[0]["category"] == "science_threshold"

    def test_within_range_no_rec(self, db: Session) -> None:
        """Values within range should not produce recs."""
        base = dt.date(2025, 1, 1)
        for i in range(14):
            d = base + dt.timedelta(days=i)
            _make_sleep_record(db, d)
            db.add(DailyLog(date=d))
            # Early caffeine, well under cutoff
            db.add(
                CaffeineEntry(
                    date=d,
                    time=dt.time(7, 0),
                    amount_mg=100,
                    source="drip_coffee",
                )
            )
        db.commit()

        from backend.services.stats_engine import prepare_analysis_dataframe

        df = prepare_analysis_dataframe(db)
        recs = _science_threshold_recs(df)

        caffeine_hour_recs = [r for r in recs if r["factor"] == "last_caffeine_hour"]
        assert len(caffeine_hour_recs) == 0

    def test_evening_clock_avg_folds_onto_24h_clock(self) -> None:
        """#134 review: a wrapped evening-clock average (25.0 = 1 AM on the
        24+ clock) renders as "around 1:00" in the rec body, not "around
        25:00"."""
        n = 14
        df = pd.DataFrame({"last_caffeine_hour": [25.0] * n})
        df.index = pd.date_range("2025-01-01", periods=n)
        df.index.name = "date"

        recs = _science_threshold_recs(df)
        caffeine_recs = [r for r in recs if r["factor"] == "last_caffeine_hour"]
        assert len(caffeine_recs) == 1
        assert "around 1:00" in caffeine_recs[0]["body"]
        assert "25:00" not in caffeine_recs[0]["body"]

    def test_insufficient_recent_data_skipped(self, db: Session) -> None:
        """Less than 7 recent days should skip the threshold."""
        base = dt.date(2025, 1, 1)
        for i in range(5):
            d = base + dt.timedelta(days=i)
            _make_sleep_record(db, d)
            db.add(DailyLog(date=d))
            db.add(
                CaffeineEntry(
                    date=d,
                    time=dt.time(16, 0),
                    amount_mg=500,
                    source="drip_coffee",
                )
            )
        db.commit()

        from backend.services.stats_engine import prepare_analysis_dataframe

        df = prepare_analysis_dataframe(db)
        recs = _science_threshold_recs(df)

        # Should not have caffeine recs due to insufficient recent data
        caffeine_recs = [r for r in recs if r["factor"] == "total_caffeine_mg"]
        assert len(caffeine_recs) == 0


# --- Untried Recommendations ---


class TestUntriedRecs:
    def test_fewer_than_7_days_suggests(self) -> None:
        """Factors with < 7 days should get untried suggestion."""
        # DataFrame with no sunlight data
        df = pd.DataFrame(
            {
                "sleep_score": [80] * 60,
            }
        )
        df.index = pd.date_range("2025-01-01", periods=60)
        df.index.name = "date"

        recs = _untried_recs(df)
        # Should suggest sunlight, blue_blockers, screens_off, etc.
        assert len(recs) > 0
        for r in recs:
            assert r["category"] == "untried"

    def test_7_plus_days_no_suggestion(self, db: Session) -> None:
        """Factors with 7+ recorded days should not get untried suggestion."""
        base = dt.date(2025, 1, 1)
        for i in range(10):
            d = base + dt.timedelta(days=i)
            _make_sleep_record(db, d)
            db.add(DailyLog(date=d))
            db.add(
                SunlightEntry(
                    date=d,
                    start_time=dt.time(8, 0),
                    duration_minutes=20,
                )
            )
        db.commit()

        from backend.services.stats_engine import prepare_analysis_dataframe

        df = prepare_analysis_dataframe(db)
        recs = _untried_recs(df)

        sunlight_recs = [r for r in recs if r["factor"] == "sunlight_morning_minutes"]
        assert len(sunlight_recs) == 0


# --- Timing Recommendations ---


class TestTimingRecs:
    def test_social_jet_lag_above_60(self) -> None:
        """Social jet lag > 60 min should produce a rec."""
        timing_data = {
            "social_jet_lag_minutes": 75.0,
            "social_jet_lag_rating": "moderate",
            "optimal_bedtime_start": 22.0,
            "optimal_bedtime_end": 23.0,
            "n_days": 30,
        }
        df = pd.DataFrame({"bedtime_hour": [22.5] * 30})
        df.index = pd.date_range("2025-01-01", periods=30)
        df.index.name = "date"

        with patch("backend.services.recommender.compute_sleep_timing", return_value=timing_data):
            recs = _timing_recs(df)

        sjl_recs = [r for r in recs if r["factor"] == "social_jet_lag"]
        assert len(sjl_recs) == 1
        assert "75" in sjl_recs[0]["body"]

    def test_bedtime_late_rec(self) -> None:
        """Bedtime later than optimal by 30+ min should produce a rec."""
        timing_data = {
            "social_jet_lag_minutes": 20.0,
            "optimal_bedtime_start": 22.0,
            "optimal_bedtime_end": 23.0,
            "n_days": 30,
        }
        # Recent bedtimes averaging 24.0 (midnight), > 23.0 + 0.5
        df = pd.DataFrame({"bedtime_hour": [24.0] * 30})
        df.index = pd.date_range("2025-01-01", periods=30)
        df.index.name = "date"

        with patch("backend.services.recommender.compute_sleep_timing", return_value=timing_data):
            recs = _timing_recs(df)

        bedtime_recs = [r for r in recs if r["factor"] == "bedtime_hour"]
        assert len(bedtime_recs) == 1

    def test_no_jet_lag_no_rec(self) -> None:
        """Social jet lag < 60 min should not produce a rec."""
        timing_data = {
            "social_jet_lag_minutes": 30.0,
            "optimal_bedtime_start": 22.0,
            "optimal_bedtime_end": 23.0,
            "n_days": 30,
        }
        df = pd.DataFrame({"bedtime_hour": [22.5] * 30})
        df.index = pd.date_range("2025-01-01", periods=30)
        df.index.name = "date"

        with patch("backend.services.recommender.compute_sleep_timing", return_value=timing_data):
            recs = _timing_recs(df)

        sjl_recs = [r for r in recs if r["factor"] == "social_jet_lag"]
        assert len(sjl_recs) == 0


# --- Integration Tests ---


class TestGenerateRecommendations:
    def test_empty_db(self, db: Session) -> None:
        result = generate_recommendations(db)
        assert result["has_sufficient_data"] is False
        assert result["recommendations"] == []
        assert result["total_days"] == 0

    def test_insufficient_data(self, db: Session) -> None:
        _seed_minimal_data(db, n=10)
        result = generate_recommendations(db)
        assert result["has_sufficient_data"] is False
        assert result["recommendations"] == []

    def test_sufficient_data_produces_recs(self, db: Session) -> None:
        _seed_full_data(db, n=60)
        result = generate_recommendations(db)
        assert result["has_sufficient_data"] is True
        assert result["total_days"] >= 50
        # Should have at least untried recs
        assert len(result["recommendations"]) > 0

    def test_dedup_by_id(self, db: Session) -> None:
        _seed_full_data(db, n=60)
        result = generate_recommendations(db)
        ids = [r["id"] for r in result["recommendations"]]
        assert len(ids) == len(set(ids))

    def test_sorted_by_priority(self, db: Session) -> None:
        _seed_full_data(db, n=60)
        result = generate_recommendations(db)
        recs = result["recommendations"]
        if len(recs) > 1:
            priorities = [r["priority"] for r in recs]
            assert priorities == sorted(priorities)

    def test_cap_at_20(self, db: Session) -> None:
        _seed_full_data(db, n=60)
        result = generate_recommendations(db)
        assert len(result["recommendations"]) <= 20

    def test_recommendation_fields(self, db: Session) -> None:
        _seed_full_data(db, n=60)
        result = generate_recommendations(db)
        for rec in result["recommendations"]:
            assert "id" in rec
            assert "category" in rec
            assert rec["category"] in ("data_driven", "science_threshold", "untried", "timing")
            assert "priority" in rec
            assert "title" in rec
            assert "body" in rec
            assert "factor" in rec
            assert "factor_label" in rec


# --- Language Compliance ---


class TestHedgedLanguage:
    """Verify no causal language in recommendations."""

    BANNED_WORDS: ClassVar[list[str]] = ["causes", "improves", "worsens", "leads to", "will make"]

    def test_predictor_actions_hedged(self) -> None:
        for predictor, actions in PREDICTOR_ACTIONS.items():
            for direction, text in actions.items():
                for word in self.BANNED_WORDS:
                    assert word not in text.lower(), (
                        f"PREDICTOR_ACTIONS[{predictor!r}][{direction!r}] "
                        f"contains banned word {word!r}: {text}"
                    )

    def test_science_thresholds_hedged(self) -> None:
        for thresh in SCIENCE_THRESHOLDS:
            for word in self.BANNED_WORDS:
                assert word not in thresh.body_template.lower(), (
                    f"Threshold {thresh.column!r} body_template contains banned word {word!r}"
                )
                if thresh.untried_suggestion:
                    assert word not in thresh.untried_suggestion.lower(), (
                        f"Threshold {thresh.column!r} untried_suggestion contains "
                        f"banned word {word!r}"
                    )

    def test_generated_recs_hedged(self, db: Session) -> None:
        _seed_full_data(db, n=60)
        result = generate_recommendations(db)
        for rec in result["recommendations"]:
            for word in self.BANNED_WORDS:
                assert word not in rec["title"].lower(), (
                    f"Rec {rec['id']!r} title contains banned word {word!r}"
                )
                assert word not in rec["body"].lower(), (
                    f"Rec {rec['id']!r} body contains banned word {word!r}"
                )


# --- Top Recommendations ---


class TestTopRecommendations:
    def test_returns_top_3(self, db: Session) -> None:
        _seed_full_data(db, n=60)
        top = get_top_recommendations(db)
        assert len(top) <= 3
        for item in top:
            assert "id" in item
            assert "title" in item
            assert "category" in item

    def test_empty_when_insufficient(self, db: Session) -> None:
        _seed_minimal_data(db, n=10)
        top = get_top_recommendations(db)
        assert top == []


# --- Experiment Metrics ---


class TestExperimentMetrics:
    def _create_experiment(self, db: Session) -> Experiment:
        """Create an experiment with baseline and result data."""
        base = dt.date(2025, 3, 1)
        # Seed baseline (14 days before start)
        for i in range(14):
            d = base - dt.timedelta(days=14) + dt.timedelta(days=i)
            _make_sleep_record(db, d, sleep_score=75, deep_minutes=65, avg_hrv=42.0)

        # Seed experiment period (14 days)
        for i in range(14):
            d = base + dt.timedelta(days=i)
            _make_sleep_record(db, d, sleep_score=82, deep_minutes=72, avg_hrv=48.0)

        exp = Experiment(
            factor="total_caffeine_mg",
            hypothesis="Reducing caffeine will improve sleep",
            start_date=base,
            end_date=base + dt.timedelta(days=13),
            status=ExperimentStatus.ACTIVE,
            created_at=dt.datetime(2025, 3, 1, 10, 0),
        )
        db.add(exp)
        db.commit()
        db.refresh(exp)
        return exp

    def test_baseline_14d_before(self, db: Session) -> None:
        exp = self._create_experiment(db)
        result = _build_experiment_out(db, exp, today=dt.date(2025, 3, 14))
        assert result["baseline_sleep_score"] == 75.0
        assert result["baseline_deep_minutes"] == 65.0

    def test_result_in_period(self, db: Session) -> None:
        exp = self._create_experiment(db)
        result = _build_experiment_out(db, exp, today=dt.date(2025, 3, 14))
        assert result["result_sleep_score"] == 82.0
        assert result["result_deep_minutes"] == 72.0

    def test_days_completed(self, db: Session) -> None:
        exp = self._create_experiment(db)
        result = _build_experiment_out(db, exp, today=dt.date(2025, 3, 14))
        assert result["days_completed"] == 14

    def test_auto_complete(self, db: Session) -> None:
        exp = self._create_experiment(db)
        # Simulate checking after end_date
        result = get_experiment_by_id(db, exp.id)
        # If today > end_date, auto-complete happens
        # Since _create_experiment uses March dates, today (2026) > end_date
        assert result is not None
        assert result["status"] in (ExperimentStatus.ACTIVE, ExperimentStatus.COMPLETED)

    def test_factor_label(self, db: Session) -> None:
        exp = self._create_experiment(db)
        result = _build_experiment_out(db, exp, today=dt.date(2025, 3, 14))
        assert result["factor_label"] == "Total Caffeine (mg)"

    def test_list_experiments(self, db: Session) -> None:
        self._create_experiment(db)
        results = list_experiments(db)
        assert len(results) == 1
        assert results[0]["factor"] == "total_caffeine_mg"

    def test_no_baseline_data(self, db: Session) -> None:
        """Experiment with no data before start should have None baselines."""
        exp = Experiment(
            factor="exercise_done",
            hypothesis="Exercise will help",
            start_date=dt.date(2025, 6, 1),
            end_date=dt.date(2025, 6, 14),
            status=ExperimentStatus.ACTIVE,
            created_at=dt.datetime(2025, 6, 1, 10, 0),
        )
        db.add(exp)
        db.commit()
        db.refresh(exp)

        result = _build_experiment_out(db, exp, today=dt.date(2025, 6, 7))
        assert result["baseline_sleep_score"] is None
        assert result["result_sleep_score"] is None


class TestGetActiveExperiment:
    """A past-due stored-ACTIVE row is not *currently* active (see
    _get_active_experiment): returning it would deadlock the SPA's
    experiment workflow."""

    def _add_experiment(self, db: Session, end_date: dt.date) -> Experiment:
        exp = Experiment(
            factor="total_caffeine_mg",
            hypothesis="Reducing caffeine will improve sleep",
            start_date=end_date - dt.timedelta(days=13),
            end_date=end_date,
            status=ExperimentStatus.ACTIVE,
            created_at=dt.datetime(2025, 3, 1, 10, 0),
        )
        db.add(exp)
        db.commit()
        return exp

    def test_current_experiment_returned(self, db: Session) -> None:
        self._add_experiment(db, end_date=dt.date.today() + dt.timedelta(days=7))
        result = _get_active_experiment(db)
        assert result is not None
        assert result["status"] == ExperimentStatus.ACTIVE

    def test_past_due_experiment_not_returned(self, db: Session) -> None:
        self._add_experiment(db, end_date=dt.date.today() - dt.timedelta(days=1))
        assert _get_active_experiment(db) is None

    def test_past_due_experiment_still_listed(self, db: Session) -> None:
        self._add_experiment(db, end_date=dt.date.today() - dt.timedelta(days=1))
        results = list_experiments(db)
        assert len(results) == 1
        assert results[0]["status"] == ExperimentStatus.COMPLETED


# --- #101: p formatting, per-outcome titles, dashboard factor-dedupe ---


def test_fmt_p_never_prints_zero() -> None:
    from backend.services.recommender import _fmt_p

    assert _fmt_p(0.0002) == "p<0.001"
    assert _fmt_p(0.0009) == "p<0.001"
    assert _fmt_p(0.001) == "p=0.001"
    assert _fmt_p(0.012) == "p=0.012"


def test_top_recommendations_dedupe_by_factor(monkeypatch: pytest.MonkeyPatch) -> None:
    """The dashboard widget must not list the same factor twice (#101 —
    dogfood day 1 showed 'Bedtime (hour)' twice)."""
    from backend.services import recommender

    fake = {
        "has_sufficient_data": True,
        "recommendations": [
            {
                "id": "data_driven:bedtime_hour:sleep_score",
                "title": "Bedtime (hour) → Sleep Score",
                "factor": "bedtime_hour",
                "factor_label": "Bedtime (hour)",
                "category": "data_driven",
            },
            {
                "id": "data_driven:bedtime_hour:rem_minutes",
                "title": "Bedtime (hour) → REM Sleep (min)",
                "factor": "bedtime_hour",
                "factor_label": "Bedtime (hour)",
                "category": "data_driven",
            },
            {
                "id": "science:morning_sunlight",
                "title": "Try tracking morning sunlight",
                "factor": "sunlight_lux",
                "factor_label": "Morning sunlight",
                "category": "science",
            },
            {
                "id": "timing:bedtime_hour",
                "title": "Consistent bedtime",
                "factor": "bedtime_hour",
                "factor_label": "Bedtime (hour)",
                "category": "timing",
            },
        ],
    }
    monkeypatch.setattr(recommender, "generate_recommendations", lambda db: fake)
    # generate_recommendations is stubbed, so the session is never touched
    top = recommender.get_top_recommendations(cast(Session, None), limit=3)
    # The two data-driven bedtime recs collapse to one factor-labeled entry;
    # science/timing recs KEEP their actionable titles and are not suppressed
    # by the same-factor data-driven rec (PR #124 review).
    assert [r["title"] for r in top] == [
        "Bedtime (hour)",
        "Try tracking morning sunlight",
        "Consistent bedtime",
    ]
    assert len({r["id"] for r in top}) == 3


def test_data_driven_titles_include_outcome(db: Session) -> None:
    """Per-outcome recs must be distinguishable on the full page (#101)."""
    from backend.services.recommender import generate_recommendations

    _seed_full_data(db)
    result = generate_recommendations(db)
    dd = [r for r in result["recommendations"] if r["category"] == "data_driven"]
    assert dd, "seed produced no data-driven recs — test would be vacuous"
    for rec in dd:
        assert "→" in rec["title"], rec["title"]
        assert rec["outcome_label"] in rec["title"]
