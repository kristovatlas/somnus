"""Tests for nap impact analysis — segmentation and baseline computation."""

import datetime as dt

import pytest
from sqlalchemy.orm import Session

from backend.models import DailyLog, NapEntry, SleepRecord
from backend.services.nap_analysis import (
    DURATION_BUCKETS,
    TIMING_BUCKETS,
    _compute_baseline,
    _segment_naps,
    compute_nap_analysis,
)


def _seed_nap_data(
    db: Session,
    nap_days: int = 10,
    no_nap_days: int = 10,
):
    """Seed data with nap and no-nap days, plus next-day sleep records."""
    base = dt.date(2025, 1, 1)

    # No-nap days first
    for i in range(no_nap_days):
        d = base + dt.timedelta(days=i)
        next_d = d + dt.timedelta(days=1)
        db.add(DailyLog(date=d))
        db.add(SleepRecord(
            date=next_d,
            onset_latency_minutes=10,
            sleep_efficiency=0.90,
            total_sleep_minutes=420,
        ))

    # Nap days
    offset = no_nap_days + 1  # gap to avoid overlap
    for i in range(nap_days):
        d = base + dt.timedelta(days=offset + i)
        next_d = d + dt.timedelta(days=1)
        db.add(DailyLog(date=d))
        db.add(NapEntry(
            date=d,
            start_time=dt.time(14, 30),
            duration_minutes=25,
        ))
        db.add(SleepRecord(
            date=next_d,
            onset_latency_minutes=12,
            sleep_efficiency=0.88,
            total_sleep_minutes=410,
        ))

    db.commit()


class TestComputeNapAnalysis:
    def test_empty_db(self, db: Session):
        result = compute_nap_analysis(db)
        assert result["total_nap_days"] == 0
        assert result["total_no_nap_days"] == 0
        assert result["segments"] == []

    def test_with_data(self, db: Session):
        _seed_nap_data(db)
        result = compute_nap_analysis(db)
        assert result["total_no_nap_days"] == 10
        assert result["total_nap_days"] == 10

    def test_baseline_computed(self, db: Session):
        _seed_nap_data(db)
        result = compute_nap_analysis(db)
        baseline = result["no_nap_baseline"]
        assert baseline["avg_onset_latency"] == 10.0
        assert baseline["avg_efficiency"] == pytest.approx(0.90)
        assert baseline["avg_total_sleep"] == 420.0

    def test_segments_correct_bucket(self, db: Session):
        _seed_nap_data(db)
        result = compute_nap_analysis(db)
        # Naps at 14:30, 25 min → "1-3 PM" timing, "20-30 min" duration
        matching = [
            s for s in result["segments"]
            if s["timing_label"] == "1-3 PM" and s["duration_label"] == "20-30 min"
        ]
        assert len(matching) == 1
        assert matching[0]["n_days"] == 10

    def test_vs_no_nap_delta(self, db: Session):
        _seed_nap_data(db)
        result = compute_nap_analysis(db)
        matching = [
            s for s in result["segments"]
            if s["timing_label"] == "1-3 PM" and s["duration_label"] == "20-30 min"
        ]
        assert len(matching) == 1
        seg = matching[0]
        # Nap days: onset 12, no-nap: onset 10, delta = +2
        assert seg["vs_no_nap_onset"] == pytest.approx(2.0)


class TestComputeBaseline:
    def test_empty_list(self):
        result = _compute_baseline([])
        assert result["avg_onset_latency"] is None
        assert result["avg_efficiency"] is None
        assert result["avg_total_sleep"] is None

    def test_with_data(self):
        days = [
            {"onset_latency_minutes": 10, "sleep_efficiency": 0.9, "total_sleep_minutes": 420},
            {"onset_latency_minutes": 12, "sleep_efficiency": 0.85, "total_sleep_minutes": 400},
        ]
        result = _compute_baseline(days)
        assert result["avg_onset_latency"] == 11.0
        assert result["avg_efficiency"] == pytest.approx(0.875)
        assert result["avg_total_sleep"] == 410.0

    def test_handles_nulls(self):
        days = [
            {"onset_latency_minutes": None, "sleep_efficiency": 0.9, "total_sleep_minutes": 420},
            {"onset_latency_minutes": 10, "sleep_efficiency": None, "total_sleep_minutes": None},
        ]
        result = _compute_baseline(days)
        assert result["avg_onset_latency"] == 10.0
        assert result["avg_efficiency"] == pytest.approx(0.9)
        assert result["avg_total_sleep"] == 420.0


class TestSegmentNaps:
    def test_empty(self):
        result = _segment_naps([], {"avg_onset_latency": 10, "avg_efficiency": 0.9, "avg_total_sleep": 420})
        assert result == []

    def test_bucket_boundaries(self):
        """14:30 → '1-3 PM', 25 min → '20-30 min'."""
        nap_days = [{
            "start_hour": 14.5,
            "duration_minutes": 25,
            "onset_latency_minutes": 12,
            "sleep_efficiency": 0.88,
            "total_sleep_minutes": 410,
        }]
        baseline = {"avg_onset_latency": 10.0, "avg_efficiency": 0.9, "avg_total_sleep": 420.0}
        result = _segment_naps(nap_days, baseline)
        assert len(result) == 1
        assert result[0]["timing_label"] == "1-3 PM"
        assert result[0]["duration_label"] == "20-30 min"

    def test_before_1pm_bucket(self):
        nap_days = [{
            "start_hour": 11.0,
            "duration_minutes": 15,
            "onset_latency_minutes": 8,
            "sleep_efficiency": 0.92,
            "total_sleep_minutes": 430,
        }]
        baseline = {"avg_onset_latency": None, "avg_efficiency": None, "avg_total_sleep": None}
        result = _segment_naps(nap_days, baseline)
        assert len(result) == 1
        assert result[0]["timing_label"] == "Before 1 PM"
        assert result[0]["duration_label"] == "< 20 min"

    def test_after_5pm_bucket(self):
        nap_days = [{
            "start_hour": 17.5,
            "duration_minutes": 45,
            "onset_latency_minutes": 15,
            "sleep_efficiency": 0.85,
            "total_sleep_minutes": 390,
        }]
        baseline = {"avg_onset_latency": 10.0, "avg_efficiency": 0.9, "avg_total_sleep": 420.0}
        result = _segment_naps(nap_days, baseline)
        assert len(result) == 1
        assert result[0]["timing_label"] == "After 5 PM"
        assert result[0]["duration_label"] == "30-60 min"

    def test_missing_start_hour_excluded(self):
        nap_days = [{
            "start_hour": None,
            "duration_minutes": 25,
            "onset_latency_minutes": 12,
            "sleep_efficiency": 0.88,
            "total_sleep_minutes": 410,
        }]
        baseline = {"avg_onset_latency": 10.0, "avg_efficiency": 0.9, "avg_total_sleep": 420.0}
        result = _segment_naps(nap_days, baseline)
        assert result == []


class TestTimingBuckets:
    def test_buckets_cover_all_hours(self):
        """Ensure timing buckets cover 0-24 hours."""
        covered = set()
        for _, low, high in TIMING_BUCKETS:
            for h in range(low, high):
                covered.add(h)
        assert 0 in covered
        assert 23 in covered

    def test_duration_buckets_cover_range(self):
        """Ensure duration buckets cover 0 to large durations."""
        assert DURATION_BUCKETS[0][1] == 0  # starts at 0
        assert DURATION_BUCKETS[-1][2] >= 60  # covers long naps
