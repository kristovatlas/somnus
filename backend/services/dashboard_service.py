"""Dashboard aggregation service — BFF pattern for GET /api/dashboard."""

from __future__ import annotations

import datetime as dt
import statistics
from typing import Any

from sqlalchemy.orm import Session

from backend.models import (
    CaffeineEntry,
    DailyLog,
    RedLightEntry,
    SleepRecord,
    UserSettings,
)
from backend.science.reference_data import (
    get_stage_targets,
    rate_delta,
    rate_drift,
    rate_sigma,
    rate_stage_vs_target,
)


def get_dashboard_data(db: Session, today: dt.date | None = None) -> dict[str, Any]:
    """Return all dashboard data in a single dict matching DashboardResponse."""
    if today is None:
        today = dt.date.today()

    settings = db.get(UserSettings, 1)
    age = settings.age if settings else None
    typical_bedtime = settings.typical_bedtime if settings else None
    caffeine_sensitivity = settings.caffeine_sensitivity if settings else "normal"

    targets = get_stage_targets(age)
    sleep_record = _get_latest_sleep_record(db, today)
    trend_records = _get_trend_data(db, today, days=7)
    trends = _build_trend_days(trend_records)
    stage_averages = _compute_stage_averages(trend_records, targets)
    consistency = _compute_consistency(trend_records, typical_bedtime)
    logging_streak = _compute_logging_streak(db, today)
    red_light_summary = _get_red_light_summary(db, today)
    today_caffeine = _get_today_caffeine(db, today)

    # Top recommendations (lightweight — returns [] if insufficient data)
    from backend.services.recommender import get_top_recommendations

    top_recs = get_top_recommendations(db)

    return {
        "sleep_record": sleep_record,
        "stage_targets": (
            {
                "age_group": targets.age_group,
                "deep_min_minutes": targets.deep_min_minutes,
                "deep_max_minutes": targets.deep_max_minutes,
                "rem_min_minutes": targets.rem_min_minutes,
                "rem_max_minutes": targets.rem_max_minutes,
            }
            if targets
            else None
        ),
        "trends": trends,
        "stage_averages": stage_averages,
        "consistency": consistency,
        "logging_streak": logging_streak,
        "red_light_summary": red_light_summary,
        "today_caffeine_entries": today_caffeine,
        "caffeine_sensitivity": caffeine_sensitivity,
        "typical_bedtime": typical_bedtime,
        "top_recommendations": top_recs,
    }


def _get_latest_sleep_record(db: Session, today: dt.date) -> SleepRecord | None:
    """Get today's sleep record, falling back to yesterday."""
    record = db.get(SleepRecord, today)
    if record is not None:
        return record
    return db.get(SleepRecord, today - dt.timedelta(days=1))


def _get_trend_data(db: Session, today: dt.date, *, days: int = 7) -> list[SleepRecord]:
    """Query the last N days of SleepRecords, oldest first."""
    start = today - dt.timedelta(days=days - 1)
    return (
        db.query(SleepRecord)
        .filter(SleepRecord.date >= start, SleepRecord.date <= today)
        .order_by(SleepRecord.date)
        .all()
    )


def _build_trend_days(records: list[SleepRecord]) -> list[dict[str, Any]]:
    """Convert SleepRecords to lightweight trend dicts."""
    return [
        {
            "date": r.date,
            "sleep_score": r.sleep_score,
            "avg_hrv": r.avg_hrv,
            "deep_minutes": r.deep_minutes,
            "rem_minutes": r.rem_minutes,
        }
        for r in records
    ]


def _compute_stage_averages(
    records: list[SleepRecord],
    targets: Any | None,
) -> dict[str, Any] | None:
    """Compute 7-day rolling averages of sleep stages."""
    deep_vals = [r.deep_minutes for r in records if r.deep_minutes is not None]
    rem_vals = [r.rem_minutes for r in records if r.rem_minutes is not None]
    light_vals = [r.light_minutes for r in records if r.light_minutes is not None]
    total_vals = [r.total_sleep_minutes for r in records if r.total_sleep_minutes is not None]

    if not deep_vals and not rem_vals:
        return None

    avg_deep = statistics.mean(deep_vals) if deep_vals else 0.0
    avg_rem = statistics.mean(rem_vals) if rem_vals else 0.0
    avg_light = statistics.mean(light_vals) if light_vals else 0.0
    avg_total = statistics.mean(total_vals) if total_vals else 0.0

    deep_vs = "in_range"
    rem_vs = "in_range"
    if targets and deep_vals:
        deep_vs = rate_stage_vs_target(avg_deep, targets.deep_min_minutes, targets.deep_max_minutes)
    if targets and rem_vals:
        rem_vs = rate_stage_vs_target(avg_rem, targets.rem_min_minutes, targets.rem_max_minutes)

    days_counted = max(len(deep_vals), len(rem_vals))

    return {
        "avg_deep_minutes": round(avg_deep, 1),
        "avg_rem_minutes": round(avg_rem, 1),
        "avg_light_minutes": round(avg_light, 1),
        "avg_total_minutes": round(avg_total, 1),
        "deep_vs_target": deep_vs,
        "rem_vs_target": rem_vs,
        "days_counted": days_counted,
    }


def _normalize_bedtime_hour(bedtime: dt.datetime) -> float:
    """Convert a bedtime datetime to decimal hours, handling midnight crossover.

    Hours before 6 AM are shifted to 24+ so that 12:30 AM = 24.5 (not 0.5),
    preserving the continuous nature of evening bedtimes.
    """
    hour = bedtime.hour + bedtime.minute / 60
    if hour < 6:
        hour += 24
    return hour


def _compute_consistency(
    records: list[SleepRecord],
    typical_bedtime: dt.time | None,
) -> dict[str, Any] | None:
    """Compute bedtime consistency metrics (σ, δ, Δ)."""
    bedtime_data = [(r.date, r.bedtime) for r in records if r.bedtime is not None]

    if len(bedtime_data) < 2:
        return None

    hours = [_normalize_bedtime_hour(bt) for _, bt in bedtime_data]

    # σ: standard deviation of bedtime
    sigma_minutes = statistics.stdev(hours) * 60
    sigma_rating = rate_sigma(sigma_minutes)

    # δ: mean offset from typical bedtime
    delta_minutes: float | None = None
    delta_rating: str | None = None
    if typical_bedtime is not None:
        typical_hour = typical_bedtime.hour + typical_bedtime.minute / 60
        if typical_hour < 6:
            typical_hour += 24
        offsets = [abs(h - typical_hour) for h in hours]
        delta_minutes = statistics.mean(offsets) * 60
        delta_rating = rate_delta(delta_minutes)

    # Δ: weekend drift
    weekday_hours = []
    weekend_hours = []
    for (date, _), hour in zip(bedtime_data, hours, strict=True):
        if date.weekday() >= 5:  # Saturday=5, Sunday=6
            weekend_hours.append(hour)
        else:
            weekday_hours.append(hour)

    drift_minutes: float | None = None
    drift_rating: str | None = None
    if weekday_hours and weekend_hours:
        drift_minutes = abs(statistics.mean(weekend_hours) - statistics.mean(weekday_hours)) * 60
        drift_rating = rate_drift(drift_minutes)

    bedtime_dots = [
        {
            "date": date,
            "bedtime_hour": round(_normalize_bedtime_hour(bt), 2),
            "is_weekend": date.weekday() >= 5,
        }
        for date, bt in bedtime_data
    ]

    return {
        "sigma_minutes": round(sigma_minutes, 1),
        "sigma_rating": sigma_rating,
        "delta_minutes": round(delta_minutes, 1) if delta_minutes is not None else None,
        "delta_rating": delta_rating,
        "weekend_drift_minutes": (round(drift_minutes, 1) if drift_minutes is not None else None),
        "drift_rating": drift_rating,
        "bedtime_dots": bedtime_dots,
        "days_counted": len(bedtime_data),
    }


def _compute_logging_streak(db: Session, today: dt.date) -> int:
    """Count consecutive days with a DailyLog entry, walking backward from today."""
    streak = 0
    current = today
    while True:
        log = db.get(DailyLog, current)
        if log is None:
            break
        streak += 1
        current -= dt.timedelta(days=1)
    return streak


def _get_red_light_summary(db: Session, today: dt.date) -> dict[str, Any]:
    """Summarize last 7 days of red light therapy sessions."""
    start = today - dt.timedelta(days=6)
    entries: list[RedLightEntry] = (
        db.query(RedLightEntry)
        .filter(RedLightEntry.date >= start, RedLightEntry.date <= today)
        .all()
    )

    session_count = len(entries)
    total_dose = sum(e.dose_joules_cm2 for e in entries if e.dose_joules_cm2 is not None)
    days_with = len({e.date for e in entries})

    return {
        "session_count": session_count,
        "total_dose_joules_cm2": round(total_dose, 2),
        "days_with_sessions": days_with,
        "meets_minimum": session_count >= 3,
    }


def _get_today_caffeine(db: Session, today: dt.date) -> list[CaffeineEntry]:
    """Get today's caffeine entries for client-side chart rendering."""
    return db.query(CaffeineEntry).filter(CaffeineEntry.date == today).all()
