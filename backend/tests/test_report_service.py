"""Tests for the report service — weekly + monthly computation."""

from __future__ import annotations

import datetime as dt

import pytest
from sqlalchemy.orm import Session

from backend.models import (
    CaffeineEntry,
    DailyLog,
    HabitEntry,
    HabitType,
    SleepRecord,
    SunlightEntry,
    UserSettings,
)
from backend.services.report_service import (
    _compute_metric_averages,
    _compute_stage_compliance,
    _compute_trend_arrows,
    _get_contributing_factors,
    _month_date_range,
    _week_date_range,
    _weeks_in_month,
    get_month_report,
    get_week_report,
    render_monthly_html,
    render_weekly_html,
)

# ---------------------------------------------------------------------------
# Date range helpers
# ---------------------------------------------------------------------------


class TestWeekDateRange:
    def test_normal_week(self) -> None:
        monday, sunday = _week_date_range(2026, 1)
        assert monday == dt.date(2025, 12, 29)
        assert sunday == dt.date(2026, 1, 4)

    def test_mid_year_week(self) -> None:
        monday, sunday = _week_date_range(2026, 8)
        assert monday.weekday() == 0
        assert sunday.weekday() == 6
        assert (sunday - monday).days == 6

    def test_year_boundary(self) -> None:
        # ISO week 1 of 2025 starts on Monday 2024-12-30
        monday, sunday = _week_date_range(2025, 1)
        assert monday == dt.date(2024, 12, 30)
        assert sunday == dt.date(2025, 1, 5)


class TestMonthDateRange:
    def test_january(self) -> None:
        first, last = _month_date_range(2026, 1)
        assert first == dt.date(2026, 1, 1)
        assert last == dt.date(2026, 1, 31)

    def test_february_non_leap(self) -> None:
        first, last = _month_date_range(2025, 2)
        assert first == dt.date(2025, 2, 1)
        assert last == dt.date(2025, 2, 28)

    def test_february_leap(self) -> None:
        first, last = _month_date_range(2024, 2)
        assert first == dt.date(2024, 2, 1)
        assert last == dt.date(2024, 2, 29)


class TestWeeksInMonth:
    def test_returns_list_of_tuples(self) -> None:
        weeks = _weeks_in_month(2026, 2)
        assert len(weeks) >= 3
        for iy, iw in weeks:
            assert isinstance(iy, int)
            assert isinstance(iw, int)

    def test_mondays_fall_in_month(self) -> None:
        weeks = _weeks_in_month(2026, 1)
        for iy, iw in weeks:
            monday = dt.date.fromisocalendar(iy, iw, 1)
            assert monday.month == 1


# ---------------------------------------------------------------------------
# Metric computation
# ---------------------------------------------------------------------------


def _make_record(**kwargs: object) -> SleepRecord:
    """Create a SleepRecord with defaults."""
    defaults = {
        "date": dt.date(2026, 1, 5),
        "sleep_score": 85,
        "avg_hrv": 45.0,
        "deep_minutes": 70,
        "rem_minutes": 90,
    }
    defaults.update(kwargs)
    return SleepRecord(**defaults)


class TestComputeMetricAverages:
    def test_empty_records(self) -> None:
        result = _compute_metric_averages([])
        assert result["avg_sleep_score"] is None
        assert result["avg_hrv"] is None

    def test_single_record(self) -> None:
        r = _make_record(sleep_score=80, avg_hrv=40.0, deep_minutes=60, rem_minutes=90)
        result = _compute_metric_averages([r])
        assert result["avg_sleep_score"] == 80.0
        assert result["avg_hrv"] == 40.0
        assert result["avg_deep_minutes"] == 60.0
        assert result["avg_rem_minutes"] == 90.0

    def test_partial_nulls(self) -> None:
        r1 = _make_record(sleep_score=80, avg_hrv=None)
        r2 = _make_record(sleep_score=90, avg_hrv=50.0)
        result = _compute_metric_averages([r1, r2])
        assert result["avg_sleep_score"] == 85.0
        assert result["avg_hrv"] == 50.0  # only one value

    def test_correct_rounding(self) -> None:
        r1 = _make_record(sleep_score=81)
        r2 = _make_record(sleep_score=82)
        r3 = _make_record(sleep_score=84)
        result = _compute_metric_averages([r1, r2, r3])
        assert result["avg_sleep_score"] == 82.3


class TestComputeTrendArrows:
    def test_up(self) -> None:
        current = {
            "avg_sleep_score": 90.0,
            "avg_hrv": 50.0,
            "avg_deep_minutes": 80.0,
            "avg_rem_minutes": 100.0,
        }
        prior = {
            "avg_sleep_score": 80.0,
            "avg_hrv": 40.0,
            "avg_deep_minutes": 70.0,
            "avg_rem_minutes": 85.0,
        }
        result = _compute_trend_arrows(current, prior)
        assert result["sleep_score"] == "up"
        assert result["avg_hrv"] == "up"

    def test_down(self) -> None:
        current = {
            "avg_sleep_score": 70.0,
            "avg_hrv": 35.0,
            "avg_deep_minutes": 50.0,
            "avg_rem_minutes": 70.0,
        }
        prior = {
            "avg_sleep_score": 80.0,
            "avg_hrv": 45.0,
            "avg_deep_minutes": 70.0,
            "avg_rem_minutes": 90.0,
        }
        result = _compute_trend_arrows(current, prior)
        assert result["sleep_score"] == "down"
        assert result["avg_hrv"] == "down"

    def test_flat(self) -> None:
        current = {
            "avg_sleep_score": 80.0,
            "avg_hrv": 45.0,
            "avg_deep_minutes": 70.0,
            "avg_rem_minutes": 90.0,
        }
        prior = {
            "avg_sleep_score": 80.5,
            "avg_hrv": 45.2,
            "avg_deep_minutes": 70.3,
            "avg_rem_minutes": 90.5,
        }
        result = _compute_trend_arrows(current, prior)
        assert result["sleep_score"] == "flat"

    def test_null_prior(self) -> None:
        current = {
            "avg_sleep_score": 80.0,
            "avg_hrv": 45.0,
            "avg_deep_minutes": 70.0,
            "avg_rem_minutes": 90.0,
        }
        prior = {
            "avg_sleep_score": None,
            "avg_hrv": None,
            "avg_deep_minutes": None,
            "avg_rem_minutes": None,
        }
        result = _compute_trend_arrows(current, prior)
        assert result["sleep_score"] is None

    def test_zero_prior(self) -> None:
        current = {
            "avg_sleep_score": 80.0,
            "avg_hrv": 45.0,
            "avg_deep_minutes": 70.0,
            "avg_rem_minutes": 90.0,
        }
        prior = {"avg_sleep_score": 0, "avg_hrv": 0, "avg_deep_minutes": 0, "avg_rem_minutes": 0}
        result = _compute_trend_arrows(current, prior)
        # Zero prior means we can't compute delta
        assert result["sleep_score"] is None


# ---------------------------------------------------------------------------
# Contributing factors
# ---------------------------------------------------------------------------


class TestContributingFactors:
    def test_empty_log(self, db: Session) -> None:
        # No DailyLog exists
        factors = _get_contributing_factors(db, dt.date(2026, 1, 5))
        assert factors == []

    def test_with_entries(self, db: Session) -> None:
        log = DailyLog(date=dt.date(2026, 1, 5))
        db.add(log)
        db.flush()

        db.add(HabitEntry(date=log.date, habit_type=HabitType.EXERCISE, duration_minutes=30))
        db.add(CaffeineEntry(date=log.date, amount_mg=200, source="drip_coffee"))
        db.add(SunlightEntry(date=log.date, start_time=dt.time(8, 0), duration_minutes=25))
        db.commit()

        factors = _get_contributing_factors(db, dt.date(2026, 1, 5))
        assert "Exercised" in factors
        assert "Caffeine: 200mg total" in factors
        assert "Morning sunlight: 25 min" in factors

    def test_no_alcohol_flag(self, db: Session) -> None:
        log = DailyLog(date=dt.date(2026, 1, 5))
        db.add(log)
        db.flush()
        # Add a non-alcohol habit so we know user was logging
        db.add(HabitEntry(date=log.date, habit_type=HabitType.EXERCISE))
        db.commit()

        factors = _get_contributing_factors(db, dt.date(2026, 1, 5))
        assert "No alcohol" in factors


# ---------------------------------------------------------------------------
# Stage compliance
# ---------------------------------------------------------------------------


class TestStageCompliance:
    def test_no_age(self) -> None:
        records = [_make_record(deep_minutes=80, rem_minutes=100)]
        result = _compute_stage_compliance(records, None)
        assert result is None

    def test_with_age(self) -> None:
        records = [
            _make_record(date=dt.date(2026, 1, 1), deep_minutes=80, rem_minutes=100),
            _make_record(date=dt.date(2026, 1, 2), deep_minutes=50, rem_minutes=80),
            _make_record(date=dt.date(2026, 1, 3), deep_minutes=90, rem_minutes=95),
        ]
        result = _compute_stage_compliance(records, 25)  # targets: deep 75-100, rem 90-120
        assert result is not None
        assert result["deep_target_nights"] == 2  # 80 and 90 >= 75
        assert result["deep_total_nights"] == 3
        assert result["rem_target_nights"] == 2  # 100 and 95 >= 90
        assert result["rem_total_nights"] == 3

    def test_partial_data(self) -> None:
        records = [
            _make_record(date=dt.date(2026, 1, 1), deep_minutes=80, rem_minutes=None),
            _make_record(date=dt.date(2026, 1, 2), deep_minutes=None, rem_minutes=100),
        ]
        result = _compute_stage_compliance(records, 25)
        assert result is not None
        assert result["deep_total_nights"] == 1
        assert result["rem_total_nights"] == 1


# ---------------------------------------------------------------------------
# Weekly report integration
# ---------------------------------------------------------------------------


def _seed_week(db: Session, monday: dt.date, n: int = 7) -> None:
    """Seed n SleepRecords starting from monday."""
    for i in range(n):
        d = monday + dt.timedelta(days=i)
        db.add(
            SleepRecord(
                date=d,
                sleep_score=80 + i,
                avg_hrv=40.0 + i,
                deep_minutes=60 + i * 2,
                rem_minutes=85 + i,
                bedtime=dt.datetime(d.year, d.month, d.day, 22, 30) - dt.timedelta(days=1),
                wake_time=dt.datetime(d.year, d.month, d.day, 6, 30),
            )
        )
        db.add(DailyLog(date=d))
    db.commit()


class TestWeeklyReport:
    def test_empty_db(self, db: Session) -> None:
        report = get_week_report(db, 2026, 8, today=dt.date(2026, 2, 19))
        assert report["has_insufficient_data"] is True
        assert report["days_with_data"] == 0

    def test_one_record(self, db: Session) -> None:
        db.add(SleepRecord(date=dt.date(2026, 2, 16), sleep_score=85))
        db.commit()
        report = get_week_report(db, 2026, 8, today=dt.date(2026, 2, 19))
        assert report["has_insufficient_data"] is True
        assert report["days_with_data"] == 1

    def test_full_week(self, db: Session) -> None:
        monday = dt.date(2026, 2, 16)
        _seed_week(db, monday, n=5)
        report = get_week_report(db, 2026, 8, today=dt.date(2026, 2, 19))
        assert report["has_insufficient_data"] is False
        assert report["days_with_data"] == 5
        assert report["current"]["avg_sleep_score"] is not None
        assert report["logging_completeness"] == "5/7 days"

    def test_with_prior_week(self, db: Session) -> None:
        _seed_week(db, dt.date(2026, 2, 9), n=7)  # prior week
        _seed_week(db, dt.date(2026, 2, 16), n=5)  # current week
        report = get_week_report(db, 2026, 8, today=dt.date(2026, 2, 19))
        assert report["prior"]["avg_sleep_score"] is not None
        # Trends should be computable
        assert report["trends"]["sleep_score"] is not None

    def test_default_params(self, db: Session) -> None:
        today = dt.date(2026, 2, 19)
        _seed_week(db, dt.date(2026, 2, 16), n=3)
        report = get_week_report(db, today=today)
        assert report["iso_year"] == 2026
        assert report["iso_week"] == 8

    def test_consistency_included(self, db: Session) -> None:
        _seed_week(db, dt.date(2026, 2, 16), n=5)
        report = get_week_report(db, 2026, 8, today=dt.date(2026, 2, 19))
        assert report["consistency"] is not None
        assert "sigma_minutes" in report["consistency"]


# ---------------------------------------------------------------------------
# Monthly report integration
# ---------------------------------------------------------------------------


class TestMonthlyReport:
    def test_empty_db(self, db: Session) -> None:
        report = get_month_report(db, 2026, 2, today=dt.date(2026, 2, 19))
        assert report["has_insufficient_data"] is True
        assert report["month_name"] == "February"

    def test_insufficient_data(self, db: Session) -> None:
        for i in range(3):
            db.add(SleepRecord(date=dt.date(2026, 2, 1 + i), sleep_score=80 + i))
        db.commit()
        report = get_month_report(db, 2026, 2, today=dt.date(2026, 2, 19))
        assert report["has_insufficient_data"] is True

    def test_full_month(self, db: Session) -> None:
        for i in range(15):
            d = dt.date(2026, 2, 1 + i)
            db.add(
                SleepRecord(
                    date=d,
                    sleep_score=70 + i,
                    avg_hrv=40.0,
                    deep_minutes=60,
                    rem_minutes=85,
                )
            )
            db.add(DailyLog(date=d))
        db.commit()
        report = get_month_report(db, 2026, 2, today=dt.date(2026, 2, 19))
        assert report["has_insufficient_data"] is False
        assert report["days_with_data"] == 15
        assert report["current"]["avg_sleep_score"] is not None

    def test_best_worst_nights(self, db: Session) -> None:
        for i in range(5):
            d = dt.date(2026, 2, 1 + i)
            db.add(SleepRecord(date=d, sleep_score=60 + i * 10))
        db.commit()
        report = get_month_report(db, 2026, 2, today=dt.date(2026, 2, 19))
        assert report["best_night"]["sleep_score"] == 100
        assert report["worst_night"]["sleep_score"] == 60

    def test_stage_compliance_with_age(self, db: Session) -> None:
        db.add(UserSettings(id=1, age=25))
        for i in range(5):
            d = dt.date(2026, 2, 1 + i)
            db.add(
                SleepRecord(
                    date=d,
                    sleep_score=80,
                    deep_minutes=80 if i % 2 == 0 else 50,
                    rem_minutes=95 if i % 2 == 0 else 70,
                )
            )
        db.commit()
        report = get_month_report(db, 2026, 2, today=dt.date(2026, 2, 19))
        assert report["stage_compliance"] is not None
        assert report["stage_compliance"]["deep_total_nights"] == 5

    def test_weekly_summaries_count(self, db: Session) -> None:
        for i in range(20):
            d = dt.date(2026, 2, 1 + i)
            db.add(SleepRecord(date=d, sleep_score=80))
        db.commit()
        report = get_month_report(db, 2026, 2, today=dt.date(2026, 2, 28))
        assert len(report["weekly_summaries"]) > 0

    def test_default_params(self, db: Session) -> None:
        today = dt.date(2026, 2, 19)
        for i in range(5):
            d = dt.date(2026, 2, 1 + i)
            db.add(SleepRecord(date=d, sleep_score=80))
        db.commit()
        report = get_month_report(db, today=today)
        assert report["year"] == 2026
        assert report["month"] == 2

    def test_best_worst_ties(self, db: Session) -> None:
        """When scores are tied, first record wins."""
        for i in range(5):
            d = dt.date(2026, 2, 1 + i)
            db.add(SleepRecord(date=d, sleep_score=80))
        db.commit()
        report = get_month_report(db, 2026, 2, today=dt.date(2026, 2, 19))
        assert report["best_night"]["date"] == dt.date(2026, 2, 1)

    def test_single_record_best_worst(self, db: Session) -> None:
        """Best and worst should be the same with a single scored record above threshold."""
        for i in range(4):
            db.add(SleepRecord(date=dt.date(2026, 2, 1 + i), sleep_score=80))
        db.commit()
        report = get_month_report(db, 2026, 2, today=dt.date(2026, 2, 19))
        # Both best and worst should exist
        assert report["best_night"] is not None
        assert report["worst_night"] is not None


# ---------------------------------------------------------------------------
# HTML rendering
# ---------------------------------------------------------------------------


class TestHTMLRendering:
    def test_weekly_html_structure(self, db: Session) -> None:
        _seed_week(db, dt.date(2026, 2, 16), n=5)
        report = get_week_report(db, 2026, 8, today=dt.date(2026, 2, 19))
        html = render_weekly_html(report)
        assert "<!DOCTYPE html>" in html
        assert "Weekly Report" in html
        assert "#1a0500" in html  # circadian background
        assert "#ff8c00" in html  # circadian text
        assert "Week 8" in html

    def test_weekly_html_contains_data(self, db: Session) -> None:
        _seed_week(db, dt.date(2026, 2, 16), n=5)
        report = get_week_report(db, 2026, 8, today=dt.date(2026, 2, 19))
        html = render_weekly_html(report)
        assert "Sleep Score" in html
        assert "HRV" in html
        assert "Logged" in html

    def test_monthly_html_structure(self, db: Session) -> None:
        for i in range(5):
            d = dt.date(2026, 2, 1 + i)
            db.add(SleepRecord(date=d, sleep_score=80))
        db.commit()
        report = get_month_report(db, 2026, 2, today=dt.date(2026, 2, 19))
        html = render_monthly_html(report)
        assert "<!DOCTYPE html>" in html
        assert "Monthly Report" in html
        assert "February" in html
        assert "#1a0500" in html

    def test_insufficient_data_message(self, db: Session) -> None:
        report = get_week_report(db, 2026, 8, today=dt.date(2026, 2, 19))
        html = render_weekly_html(report)
        assert "Insufficient data" in html

    def test_weekly_html_factor_slope_phrase(self) -> None:
        """#17 export parity: factor items carry the compact slope phrase
        the SPA's TopFactorsCard shows, when an effect exists."""
        report = _minimal_weekly_report(
            top_positive_factors=[
                {
                    "label": "Exercise Duration (min)",
                    "pearson_r": 0.5,
                    "n_days": 30,
                    "effect": {
                        "value": 1.8,
                        "increment_label": "30 min",
                        "outcome_unit": "points",
                    },
                }
            ],
            top_negative_factors=[
                {
                    "label": "Bedtime (hour)",
                    "pearson_r": -0.62,
                    "n_days": 44,
                    "effect": {
                        "value": -2.3,
                        "increment_label": "hour later",
                        "outcome_unit": "points",
                    },
                }
            ],
            factors_total_days=44,
        )
        html = render_weekly_html(report)
        assert "&#8776;1.8 points higher per 30 min" in html
        assert "&#8776;2.3 points lower per hour later" in html
        assert "(r=0.50, n=30)" in html
        assert "(r=-0.62, n=44)" in html

    def test_weekly_html_factor_phrase_suppressed_below_floor(self) -> None:
        """Same 0.05 display floor as the SPA: a magnitude that would show as
        0.0 renders no slope phrase, just the label and stats."""
        report = _minimal_weekly_report(
            top_positive_factors=[
                {
                    "label": "Naps",
                    "pearson_r": 0.12,
                    "n_days": 30,
                    "effect": {
                        "value": 0.04,
                        "increment_label": "30 min",
                        "outcome_unit": "points",
                    },
                }
            ],
            top_negative_factors=[],
            factors_total_days=30,
        )
        html = render_weekly_html(report)
        assert "&#8776;" not in html
        assert "<strong>Naps</strong> (r=0.12, n=30)" in html


# ---------------------------------------------------------------------------
# HTML escaping (T-04 — docs/THREAT_MODEL.md)
# ---------------------------------------------------------------------------

_XSS = "<script>alert(1)</script>"


def _minimal_monthly_report(**overrides: object) -> dict[str, object]:
    report: dict[str, object] = {
        "current": {},
        "prior": {},
        "trends": {},
        "month_name": "February",
        "year": 2026,
        "period_start": dt.date(2026, 2, 1),
        "period_end": dt.date(2026, 2, 28),
        "logging_completeness": "5/28 days",
        "has_insufficient_data": False,
    }
    report.update(overrides)
    return report


def _minimal_weekly_report(**overrides: object) -> dict[str, object]:
    report: dict[str, object] = {
        "current": {},
        "prior": {},
        "trends": {},
        "iso_year": 2026,
        "iso_week": 8,
        "period_start": dt.date(2026, 2, 16),
        "period_end": dt.date(2026, 2, 22),
        "logging_completeness": "5/7 days",
        "has_insufficient_data": False,
    }
    report.update(overrides)
    return report


class TestHTMLEscaping:
    """Every user-controllable value must be escaped before interpolation."""

    def test_monthly_escapes_hypothesis(self) -> None:
        report = _minimal_monthly_report(
            active_experiment={
                "factor_label": "Caffeine",
                "hypothesis": _XSS,
                "start_date": dt.date(2026, 2, 1),
                "end_date": dt.date(2026, 2, 15),
                "days_completed": 5,
            }
        )
        html = render_monthly_html(report)
        assert _XSS not in html
        assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html

    def test_monthly_escapes_raw_factor_fallback(self) -> None:
        # factor_label missing -> falls back to the raw user-supplied factor
        report = _minimal_monthly_report(
            active_experiment={
                "factor": '<img src=x onerror="alert(1)">',
                "hypothesis": "h",
                "days_completed": 0,
            }
        )
        html = render_monthly_html(report)
        assert "<img" not in html
        assert "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;" in html

    def test_monthly_escapes_contributing_factor_tags(self) -> None:
        report = _minimal_monthly_report(
            best_night={
                "date": dt.date(2026, 2, 3),
                "sleep_score": 90,
                "contributing_factors": [_XSS],
            }
        )
        html = render_monthly_html(report)
        assert _XSS not in html
        assert "&lt;script&gt;" in html

    def test_weekly_escapes_factor_label(self) -> None:
        report = _minimal_weekly_report(
            top_positive_factors=[{"label": _XSS, "pearson_r": 0.5, "n_days": 20}],
            top_negative_factors=[{"label": _XSS, "pearson_r": -0.5, "n_days": 20}],
            factors_total_days=30,
        )
        html = render_weekly_html(report)
        assert _XSS not in html
        assert html.count("&lt;script&gt;alert(1)&lt;/script&gt;") == 2
        assert "across all 30 days" in html

    def test_weekly_escapes_factor_effect_fields(self) -> None:
        """The #17 slope phrase interpolates increment_label and outcome_unit;
        both are code constants today, but the invariant says every non-numeric
        hole goes through _esc anyway."""
        evil_effect = {"value": -2.3, "increment_label": _XSS, "outcome_unit": _XSS}
        report = _minimal_weekly_report(
            top_positive_factors=[
                {"label": "Exercise", "pearson_r": 0.5, "n_days": 20, "effect": dict(evil_effect)}
            ],
            top_negative_factors=[
                {"label": "Caffeine", "pearson_r": -0.5, "n_days": 20, "effect": dict(evil_effect)}
            ],
            factors_total_days=30,
        )
        html = render_weekly_html(report)
        assert _XSS not in html
        # 2 factors x (increment_label + outcome_unit)
        assert html.count("&lt;script&gt;alert(1)&lt;/script&gt;") == 4

    def test_weekly_escapes_consistency_ratings(self) -> None:
        report = _minimal_weekly_report(
            consistency={
                "sigma_minutes": 30.0,
                "sigma_rating": _XSS,
                "delta_minutes": 10.0,
                "delta_rating": _XSS,
                "weekend_drift_minutes": 5.0,
                "drift_rating": _XSS,
            }
        )
        html = render_weekly_html(report)
        assert _XSS not in html
        assert html.count("&lt;script&gt;") == 3

    def test_escaped_output_preserves_plain_text(self) -> None:
        report = _minimal_monthly_report(
            active_experiment={
                "factor_label": "Caffeine (mg)",
                "hypothesis": "Less caffeine → deeper sleep & higher HRV",
                "days_completed": 3,
            }
        )
        html = render_monthly_html(report)
        assert "Caffeine (mg)" in html
        assert "Less caffeine → deeper sleep &amp; higher HRV" in html


# ---------------------------------------------------------------------------
# #102: top factors — top-3 per direction, noise floor, all-time caption data
# ---------------------------------------------------------------------------


class TestGetTopFactors:
    def _fake_results(self) -> list[dict[str, object]]:
        def corr(pred: str, r: float, n: int = 30) -> dict[str, object]:
            return {
                "predictor": pred,
                "outcome": "sleep_score",
                "pearson_r": r,
                "n_days": n,
                "effect": {"value": r * 5, "increment_label": "unit", "outcome_unit": "points"},
            }

        return [
            corr("sunlight_lux", 0.42),
            corr("exercise_minutes", 0.31),
            corr("sauna_minutes", 0.18),
            corr("warm_shower", 0.12),  # 4th positive — must be cut at 3
            corr("meals_count", 0.04),  # below the 0.1 noise floor
            corr("bedtime_hour", -0.32),
            corr("alcohol_drinks", -0.21),
            corr("caffeine_mg", -0.09),  # below the noise floor
            {"predictor": "x", "outcome": "deep_minutes", "pearson_r": 0.9, "n_days": 30},
        ]

    def test_top3_noise_filtered_with_total(
        self, db: Session, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        import pandas as pd

        from backend.services import report_service

        monkeypatch.setattr(
            "backend.services.stats_engine.prepare_analysis_dataframe",
            lambda _db: pd.DataFrame({"sleep_score": range(45)}),
        )
        monkeypatch.setattr(
            "backend.services.stats_engine.compute_correlations",
            lambda _df: (self._fake_results(), 0),
        )
        pos, neg, total = report_service._get_top_factors(db)
        assert total == 45
        assert [f["pearson_r"] for f in pos] == [0.42, 0.31, 0.18]  # capped at 3
        assert [f["pearson_r"] for f in neg] == [-0.32, -0.21]  # floor cuts -0.09
        assert all("n_days" in f and "label" in f for f in pos + neg)
        # #17: the natural-units effect passes through to the card
        assert all(f["effect"] is not None for f in pos + neg)
        # the deep_minutes outcome result never leaks into a sleep-score card
        assert not any(f["pearson_r"] == 0.9 for f in pos)

    def test_empty_dataframe(self, db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
        import pandas as pd

        monkeypatch.setattr(
            "backend.services.stats_engine.prepare_analysis_dataframe",
            lambda _db: pd.DataFrame(),
        )
        from backend.services import report_service

        assert report_service._get_top_factors(db) == ([], [], 0)
