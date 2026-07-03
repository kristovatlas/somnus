"""Tests for the dashboard service and endpoint."""

from __future__ import annotations

import datetime as dt
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.models import (
    CaffeineEntry,
    CaffeineSource,
    DailyLog,
    RedLightEntry,
    RedLightPanel,
    SleepRecord,
    UserSettings,
)
from backend.services.dashboard_service import (
    _compute_consistency,
    _compute_logging_streak,
    _compute_stage_averages,
    _get_latest_sleep_record,
    _get_red_light_summary,
    _normalize_bedtime_hour,
    get_dashboard_data,
)

D1 = dt.date(2025, 6, 15)  # Sunday
D2 = dt.date(2025, 6, 16)  # Monday
D3 = dt.date(2025, 6, 17)  # Tuesday
D4 = dt.date(2025, 6, 18)  # Wednesday
D5 = dt.date(2025, 6, 19)  # Thursday
D6 = dt.date(2025, 6, 20)  # Friday
D7 = dt.date(2025, 6, 21)  # Saturday


def _make_settings(db: Session, **kwargs: Any) -> UserSettings:
    defaults: dict[str, Any] = {"id": 1, "onboarding_completed": True}
    defaults.update(kwargs)
    s = UserSettings(**defaults)
    db.add(s)
    db.commit()
    return s


def _make_sleep_record(db: Session, date: dt.date, **kwargs: object) -> SleepRecord:
    r = SleepRecord(date=date, **kwargs)
    db.add(r)
    db.commit()
    return r


def _make_daily_log(db: Session, date: dt.date) -> DailyLog:
    log = DailyLog(date=date)
    db.add(log)
    db.commit()
    return log


# --- _normalize_bedtime_hour ---


class TestNormalizeBedtimeHour:
    def test_evening_hour(self) -> None:
        bt = dt.datetime(2025, 6, 15, 22, 30)
        assert _normalize_bedtime_hour(bt) == 22.5

    def test_midnight_crossover(self) -> None:
        bt = dt.datetime(2025, 6, 16, 0, 30)
        assert _normalize_bedtime_hour(bt) == 24.5

    def test_early_morning(self) -> None:
        bt = dt.datetime(2025, 6, 16, 5, 0)
        assert _normalize_bedtime_hour(bt) == 29.0

    def test_exactly_six(self) -> None:
        bt = dt.datetime(2025, 6, 16, 6, 0)
        assert _normalize_bedtime_hour(bt) == 6.0

    def test_exactly_midnight(self) -> None:
        bt = dt.datetime(2025, 6, 16, 0, 0)
        assert _normalize_bedtime_hour(bt) == 24.0


# --- _get_latest_sleep_record ---


class TestGetLatestSleepRecord:
    def test_today_exists(self, db: Session) -> None:
        _make_sleep_record(db, D7, sleep_score=85)
        result = _get_latest_sleep_record(db, D7)
        assert result is not None
        assert result.date == D7

    def test_falls_back_to_yesterday(self, db: Session) -> None:
        _make_sleep_record(db, D6, sleep_score=80)
        result = _get_latest_sleep_record(db, D7)
        assert result is not None
        assert result.date == D6

    def test_none_when_no_recent(self, db: Session) -> None:
        result = _get_latest_sleep_record(db, D7)
        assert result is None


# --- _compute_stage_averages ---


class TestComputeStageAverages:
    def test_no_records(self) -> None:
        assert _compute_stage_averages([], None) is None

    def test_with_data_no_targets(self, db: Session) -> None:
        r1 = _make_sleep_record(
            db, D1, deep_minutes=80, rem_minutes=100, light_minutes=200, total_sleep_minutes=380
        )
        r2 = _make_sleep_record(
            db, D2, deep_minutes=60, rem_minutes=90, light_minutes=210, total_sleep_minutes=360
        )
        result = _compute_stage_averages([r1, r2], None)
        assert result is not None
        assert result["avg_deep_minutes"] == 70.0
        assert result["avg_rem_minutes"] == 95.0
        assert result["deep_vs_target"] == "in_range"  # default when no targets
        assert result["days_counted"] == 2

    def test_with_targets_below(self, db: Session) -> None:
        from backend.science.reference_data import get_stage_targets

        targets = get_stage_targets(25)  # deep: 75-100, rem: 90-120
        r1 = _make_sleep_record(db, D1, deep_minutes=50, rem_minutes=70)
        result = _compute_stage_averages([r1], targets)
        assert result is not None
        assert result["deep_vs_target"] == "below"
        assert result["rem_vs_target"] == "below"

    def test_some_null_stages(self, db: Session) -> None:
        r1 = _make_sleep_record(db, D1, deep_minutes=80, rem_minutes=None)
        r2 = _make_sleep_record(db, D2, deep_minutes=60, rem_minutes=100)
        result = _compute_stage_averages([r1, r2], None)
        assert result is not None
        assert result["avg_deep_minutes"] == 70.0
        assert result["avg_rem_minutes"] == 100.0  # only one value


# --- _compute_consistency ---


class TestComputeConsistency:
    def test_insufficient_data(self) -> None:
        assert _compute_consistency([], None) is None

    def test_one_record(self, db: Session) -> None:
        r = _make_sleep_record(db, D1, bedtime=dt.datetime(2025, 6, 14, 22, 0))
        assert _compute_consistency([r], None) is None

    def test_consistent_bedtimes(self, db: Session) -> None:
        r1 = _make_sleep_record(db, D2, bedtime=dt.datetime(2025, 6, 15, 22, 0))
        r2 = _make_sleep_record(db, D3, bedtime=dt.datetime(2025, 6, 16, 22, 15))
        result = _compute_consistency([r1, r2], None)
        assert result is not None
        assert result["sigma_rating"] == "consistent"
        assert result["days_counted"] == 2
        assert len(result["bedtime_dots"]) == 2

    def test_erratic_bedtimes(self, db: Session) -> None:
        r1 = _make_sleep_record(db, D2, bedtime=dt.datetime(2025, 6, 15, 21, 0))
        r2 = _make_sleep_record(db, D3, bedtime=dt.datetime(2025, 6, 17, 1, 0))  # 25.0 vs 21.0
        result = _compute_consistency([r1, r2], None)
        assert result is not None
        # stdev of [21.0, 25.0] = 2.828... hours = 169.7 min → erratic
        assert result["sigma_rating"] == "erratic"

    def test_with_typical_bedtime(self, db: Session) -> None:
        r1 = _make_sleep_record(db, D2, bedtime=dt.datetime(2025, 6, 15, 22, 0))
        r2 = _make_sleep_record(db, D3, bedtime=dt.datetime(2025, 6, 16, 22, 30))
        typical = dt.time(22, 0)
        result = _compute_consistency([r1, r2], typical)
        assert result is not None
        assert result["delta_minutes"] is not None
        assert result["delta_rating"] is not None

    def test_no_typical_bedtime(self, db: Session) -> None:
        r1 = _make_sleep_record(db, D2, bedtime=dt.datetime(2025, 6, 15, 22, 0))
        r2 = _make_sleep_record(db, D3, bedtime=dt.datetime(2025, 6, 16, 22, 30))
        result = _compute_consistency([r1, r2], None)
        assert result is not None
        assert result["delta_minutes"] is None
        assert result["delta_rating"] is None

    def test_weekend_drift(self, db: Session) -> None:
        # D1=Sunday, D2=Monday
        r1 = _make_sleep_record(db, D1, bedtime=dt.datetime(2025, 6, 14, 23, 0))
        r2 = _make_sleep_record(db, D2, bedtime=dt.datetime(2025, 6, 15, 22, 0))
        result = _compute_consistency([r1, r2], None)
        assert result is not None
        assert result["weekend_drift_minutes"] is not None
        assert result["drift_rating"] is not None

    def test_no_weekend_data(self, db: Session) -> None:
        # D2=Monday, D3=Tuesday — no weekend
        r1 = _make_sleep_record(db, D2, bedtime=dt.datetime(2025, 6, 15, 22, 0))
        r2 = _make_sleep_record(db, D3, bedtime=dt.datetime(2025, 6, 16, 22, 30))
        result = _compute_consistency([r1, r2], None)
        assert result is not None
        assert result["weekend_drift_minutes"] is None
        assert result["drift_rating"] is None

    def test_midnight_crossover_bedtimes(self, db: Session) -> None:
        r1 = _make_sleep_record(db, D2, bedtime=dt.datetime(2025, 6, 15, 23, 30))
        r2 = _make_sleep_record(db, D3, bedtime=dt.datetime(2025, 6, 17, 0, 30))
        result = _compute_consistency([r1, r2], None)
        assert result is not None
        # 23.5 and 24.5 → stdev ≈ 42.4 min → somewhat
        assert result["sigma_rating"] == "somewhat_inconsistent"


# --- _compute_logging_streak ---


class TestComputeLoggingStreak:
    def test_no_logs(self, db: Session) -> None:
        assert _compute_logging_streak(db, D7) == 0

    def test_consecutive_streak(self, db: Session) -> None:
        _make_daily_log(db, D5)
        _make_daily_log(db, D6)
        _make_daily_log(db, D7)
        assert _compute_logging_streak(db, D7) == 3

    def test_gap_breaks_streak(self, db: Session) -> None:
        _make_daily_log(db, D5)
        # skip D6
        _make_daily_log(db, D7)
        assert _compute_logging_streak(db, D7) == 1


# --- _get_red_light_summary ---


class TestGetRedLightSummary:
    def test_no_sessions(self, db: Session) -> None:
        result = _get_red_light_summary(db, D7)
        assert result["session_count"] == 0
        assert result["total_dose_joules_cm2"] == 0.0
        assert result["meets_minimum"] is False

    def test_with_sessions(self, db: Session) -> None:
        panel = RedLightPanel(name="Test Panel", irradiance_mw_cm2=50.0)
        db.add(panel)
        db.flush()

        _make_daily_log(db, D6)
        _make_daily_log(db, D7)

        e1 = RedLightEntry(date=D6, panel_id=panel.id, duration_minutes=10)
        e2 = RedLightEntry(date=D7, panel_id=panel.id, duration_minutes=15)
        e3 = RedLightEntry(date=D7, panel_id=panel.id, duration_minutes=5)
        db.add_all([e1, e2, e3])
        db.commit()

        result = _get_red_light_summary(db, D7)
        assert result["session_count"] == 3
        assert result["days_with_sessions"] == 2
        assert result["meets_minimum"] is True
        assert result["total_dose_joules_cm2"] > 0

    def test_no_panel_dose(self, db: Session) -> None:
        _make_daily_log(db, D7)
        e = RedLightEntry(date=D7, duration_minutes=10)
        db.add(e)
        db.commit()

        result = _get_red_light_summary(db, D7)
        assert result["session_count"] == 1
        assert result["total_dose_joules_cm2"] == 0.0


# --- get_dashboard_data (integration) ---


class TestGetDashboardData:
    def test_empty_db(self, db: Session) -> None:
        _make_settings(db)
        data = get_dashboard_data(db, today=D7)
        assert data["sleep_record"] is None
        assert data["trends"] == []
        assert data["stage_averages"] is None
        assert data["consistency"] is None
        assert data["logging_streak"] == 0
        assert data["red_light_summary"]["session_count"] == 0

    def test_with_sleep_records(self, db: Session) -> None:
        _make_settings(db)
        _make_sleep_record(
            db,
            D7,
            sleep_score=85,
            avg_hrv=45.0,
            deep_minutes=80,
            rem_minutes=100,
            light_minutes=200,
            total_sleep_minutes=380,
            bedtime=dt.datetime(2025, 6, 20, 22, 0),
        )
        data = get_dashboard_data(db, today=D7)
        assert data["sleep_record"] is not None
        assert data["sleep_record"].sleep_score == 85
        assert len(data["trends"]) == 1

    def test_with_age_targets_present(self, db: Session) -> None:
        _make_settings(db, age=25)
        data = get_dashboard_data(db, today=D7)
        assert data["stage_targets"] is not None
        assert data["stage_targets"]["age_group"] == "18-30"

    def test_without_age_targets_null(self, db: Session) -> None:
        _make_settings(db, age=None)
        data = get_dashboard_data(db, today=D7)
        assert data["stage_targets"] is None

    def test_with_daily_logs_streak(self, db: Session) -> None:
        _make_settings(db)
        _make_daily_log(db, D6)
        _make_daily_log(db, D7)
        data = get_dashboard_data(db, today=D7)
        assert data["logging_streak"] == 2

    def test_consistency_populated(self, db: Session) -> None:
        _make_settings(db, typical_bedtime=dt.time(22, 0))
        _make_sleep_record(db, D6, bedtime=dt.datetime(2025, 6, 19, 22, 0))
        _make_sleep_record(db, D7, bedtime=dt.datetime(2025, 6, 20, 22, 30))
        data = get_dashboard_data(db, today=D7)
        assert data["consistency"] is not None
        assert data["consistency"]["sigma_minutes"] is not None

    def test_consistency_null_insufficient_data(self, db: Session) -> None:
        _make_settings(db)
        _make_sleep_record(db, D7, bedtime=dt.datetime(2025, 6, 20, 22, 0))
        data = get_dashboard_data(db, today=D7)
        assert data["consistency"] is None

    def test_today_caffeine_entries(self, db: Session) -> None:
        _make_settings(db)
        _make_daily_log(db, D7)
        e = CaffeineEntry(date=D7, amount_mg=95, source=CaffeineSource.ESPRESSO)
        db.add(e)
        db.commit()
        data = get_dashboard_data(db, today=D7)
        assert len(data["today_caffeine_entries"]) == 1


# --- Endpoint tests ---


class TestDashboardEndpoint:
    def test_empty_db_returns_valid(self, client: TestClient, db: Session) -> None:
        _make_settings(db)
        resp = client.get("/api/dashboard")
        assert resp.status_code == 200
        body = resp.json()
        assert body["sleep_record"] is None
        assert body["logging_streak"] == 0
        assert body["red_light_summary"]["session_count"] == 0

    def test_with_data(self, client: TestClient, db: Session) -> None:
        today = dt.date.today()
        _make_settings(db, age=35)
        _make_sleep_record(
            db,
            today,
            sleep_score=90,
            deep_minutes=70,
            rem_minutes=95,
            light_minutes=200,
            total_sleep_minutes=365,
            bedtime=dt.datetime.combine(today - dt.timedelta(days=1), dt.time(22, 0)),
        )
        _make_daily_log(db, today)
        resp = client.get("/api/dashboard")
        assert resp.status_code == 200
        body = resp.json()
        assert body["sleep_record"]["sleep_score"] == 90
        assert body["stage_targets"]["age_group"] == "31-50"
        assert body["logging_streak"] == 1
        assert len(body["trends"]) == 1
