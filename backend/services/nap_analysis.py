"""Nap impact analysis — segmented by timing and duration."""

from __future__ import annotations

from typing import Any

import pandas as pd
from sqlalchemy.orm import Session, joinedload

from backend.models import DailyLog, NapEntry, SleepRecord

# Timing buckets (start hour ranges)
TIMING_BUCKETS = [
    ("Before 1 PM", 0, 13),
    ("1-3 PM", 13, 15),
    ("3-5 PM", 15, 17),
    ("After 5 PM", 17, 24),
]

# Duration buckets (minutes)
DURATION_BUCKETS = [
    ("< 20 min", 0, 20),
    ("20-30 min", 20, 30),
    ("30-60 min", 30, 60),
    ("> 60 min", 60, 999),
]


def compute_nap_analysis(db: Session) -> dict[str, Any]:
    """Analyze nap impact on next-night sleep outcomes.

    Segments naps by timing and duration, compares each segment
    to no-nap baseline.
    """
    # Get all daily logs with nap entries
    logs = (
        db.query(DailyLog)
        .options(joinedload(DailyLog.nap_entries))
        .all()
    )

    # Get all sleep records
    sleep_records = db.query(SleepRecord).all()
    sleep_by_date = {r.date: r for r in sleep_records}

    # Build nap day vs no-nap day datasets
    nap_days: list[dict[str, Any]] = []
    no_nap_days: list[dict[str, Any]] = []

    for log in logs:
        # Get NEXT day's sleep record (nap today → sleep tonight)
        import datetime as dt
        next_date = log.date + dt.timedelta(days=1)
        sleep = sleep_by_date.get(next_date)
        if sleep is None:
            continue

        sleep_data = {
            "onset_latency_minutes": sleep.onset_latency_minutes,
            "sleep_efficiency": sleep.sleep_efficiency,
            "total_sleep_minutes": sleep.total_sleep_minutes,
        }

        if log.nap_entries:
            for nap in log.nap_entries:
                nap_row = {**sleep_data}
                if nap.start_time is not None:
                    nap_row["start_hour"] = nap.start_time.hour + nap.start_time.minute / 60
                else:
                    nap_row["start_hour"] = None
                nap_row["duration_minutes"] = nap.duration_minutes
                nap_days.append(nap_row)
        else:
            no_nap_days.append(sleep_data)

    # Compute no-nap baseline
    baseline = _compute_baseline(no_nap_days)

    # Segment nap days
    segments = _segment_naps(nap_days, baseline)

    return {
        "no_nap_baseline": baseline,
        "segments": segments,
        "total_nap_days": len(nap_days),
        "total_no_nap_days": len(no_nap_days),
    }


def _compute_baseline(no_nap_days: list[dict[str, Any]]) -> dict[str, float | None]:
    """Compute average sleep metrics for no-nap days."""
    if not no_nap_days:
        return {
            "avg_onset_latency": None,
            "avg_efficiency": None,
            "avg_total_sleep": None,
        }

    onset_vals = [d["onset_latency_minutes"] for d in no_nap_days if d["onset_latency_minutes"] is not None]
    eff_vals = [d["sleep_efficiency"] for d in no_nap_days if d["sleep_efficiency"] is not None]
    total_vals = [d["total_sleep_minutes"] for d in no_nap_days if d["total_sleep_minutes"] is not None]

    return {
        "avg_onset_latency": round(sum(onset_vals) / len(onset_vals), 1) if onset_vals else None,
        "avg_efficiency": round(sum(eff_vals) / len(eff_vals), 4) if eff_vals else None,
        "avg_total_sleep": round(sum(total_vals) / len(total_vals), 1) if total_vals else None,
    }


def _segment_naps(
    nap_days: list[dict[str, Any]],
    baseline: dict[str, float | None],
) -> list[dict[str, Any]]:
    """Segment nap days by timing × duration buckets."""
    segments: list[dict[str, Any]] = []

    for timing_label, t_min, t_max in TIMING_BUCKETS:
        for dur_label, d_min, d_max in DURATION_BUCKETS:
            matching = [
                d for d in nap_days
                if d.get("start_hour") is not None
                and d.get("duration_minutes") is not None
                and t_min <= d["start_hour"] < t_max
                and d_min <= d["duration_minutes"] < d_max
            ]

            if not matching:
                continue

            onset_vals = [
                d["onset_latency_minutes"]
                for d in matching
                if d["onset_latency_minutes"] is not None
            ]
            eff_vals = [
                d["sleep_efficiency"]
                for d in matching
                if d["sleep_efficiency"] is not None
            ]
            total_vals = [
                d["total_sleep_minutes"]
                for d in matching
                if d["total_sleep_minutes"] is not None
            ]

            avg_onset = round(sum(onset_vals) / len(onset_vals), 1) if onset_vals else None
            avg_eff = round(sum(eff_vals) / len(eff_vals), 4) if eff_vals else None
            avg_total = round(sum(total_vals) / len(total_vals), 1) if total_vals else None

            # Delta vs no-nap baseline
            vs_no_nap = None
            if avg_onset is not None and baseline["avg_onset_latency"] is not None:
                vs_no_nap = round(avg_onset - baseline["avg_onset_latency"], 1)

            segments.append({
                "timing_label": timing_label,
                "duration_label": dur_label,
                "n_days": len(matching),
                "avg_onset_latency": avg_onset,
                "avg_efficiency": avg_eff,
                "avg_total_sleep": avg_total,
                "vs_no_nap_onset": vs_no_nap,
            })

    return segments
