"""Integration tests for analysis API endpoints."""

import datetime as dt

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.models import CaffeineEntry, DailyLog, HabitEntry, HabitType, SleepRecord


def _seed_data(db: Session, n: int = 20):
    """Seed n days of sleep + daily log data."""
    base = dt.date(2025, 1, 1)
    for i in range(n):
        d = base + dt.timedelta(days=i)
        db.add(SleepRecord(
            date=d,
            sleep_score=70 + (i % 20),
            deep_minutes=60 + (i % 15),
            rem_minutes=80 + (i % 10),
            light_minutes=240,
            total_sleep_minutes=400 + i,
            sleep_efficiency=0.88 + (i % 5) * 0.01,
            onset_latency_minutes=8 + (i % 10),
            avg_hrv=40.0 + i * 0.5,
            bedtime=dt.datetime.combine(
                d - dt.timedelta(days=1), dt.time(22, 30)
            ),
            wake_time=dt.datetime.combine(d, dt.time(6, 30)),
        ))
        db.add(DailyLog(date=d))
        db.add(CaffeineEntry(
            date=d,
            time=dt.time(8, 0),
            amount_mg=100 + i * 5,
            source="drip_coffee",
        ))
        db.add(HabitEntry(
            date=d,
            habit_type=HabitType.STRESS_LEVEL,
            value=str(3 + (i % 5)),
        ))
    db.commit()


class TestAnalysisStatus:
    def test_empty_db(self, client: TestClient):
        resp = client.get("/api/analysis/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_sleep_days"] == 0
        assert data["phase_a_unlocked"] is False
        assert data["phase_b_unlocked"] is False
        assert data["phase_c_unlocked"] is False
        assert data["variables"] == []

    def test_with_data(self, db: Session, client: TestClient):
        _seed_data(db, n=20)
        resp = client.get("/api/analysis/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_sleep_days"] == 20
        assert data["phase_a_unlocked"] is True
        assert isinstance(data["variables"], list)
        assert len(data["variables"]) > 0

    def test_variable_fields(self, db: Session, client: TestClient):
        _seed_data(db, n=20)
        resp = client.get("/api/analysis/status")
        data = resp.json()
        for var in data["variables"]:
            assert "name" in var
            assert "label" in var
            assert "n_days" in var
            assert isinstance(var["has_correlations"], bool)
            assert isinstance(var["has_regression"], bool)


class TestAnalysisCorrelations:
    def test_empty_db(self, client: TestClient):
        resp = client.get("/api/analysis/correlations")
        assert resp.status_code == 200
        data = resp.json()
        assert data["results"] == []
        assert data["total_days"] == 0

    def test_with_data(self, db: Session, client: TestClient):
        _seed_data(db, n=20)
        resp = client.get("/api/analysis/correlations")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_days"] == 20

    def test_r_values_bounded(self, db: Session, client: TestClient):
        _seed_data(db, n=30)
        resp = client.get("/api/analysis/correlations")
        data = resp.json()
        for r in data["results"]:
            assert -1.0 <= r["pearson_r"] <= 1.0
            assert -1.0 <= r["spearman_r"] <= 1.0

    def test_correlation_fields(self, db: Session, client: TestClient):
        _seed_data(db, n=20)
        resp = client.get("/api/analysis/correlations")
        data = resp.json()
        for r in data["results"]:
            assert "predictor" in r
            assert "predictor_label" in r
            assert "outcome" in r
            assert "outcome_label" in r
            assert "p_value" in r
            assert "n_days" in r
            assert r["confidence"] in ("low", "moderate", "high")


class TestAnalysisRegression:
    def test_empty_db(self, client: TestClient):
        resp = client.get("/api/analysis/regression")
        assert resp.status_code == 200
        data = resp.json()
        assert data["results"] == []

    def test_insufficient_data(self, db: Session, client: TestClient):
        _seed_data(db, n=10)
        resp = client.get("/api/analysis/regression")
        assert resp.status_code == 200
        data = resp.json()
        # 10 days is not enough for regression (min_days=50)
        assert data["results"] == []

    def test_with_sufficient_data(self, db: Session, client: TestClient):
        _seed_data(db, n=60)
        resp = client.get("/api/analysis/regression")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_days"] == 60
        # Should have at least one regression result
        if data["results"]:
            result = data["results"][0]
            assert "outcome" in result
            assert "r_squared" in result
            assert 0 <= result["r_squared"] <= 1.0
            assert isinstance(result["coefficients"], list)


class TestAnalysisTiming:
    def test_empty_db(self, client: TestClient):
        resp = client.get("/api/analysis/timing")
        assert resp.status_code == 200
        data = resp.json()
        assert data["chronotype"] is None
        assert data["n_days"] == 0

    def test_insufficient_data(self, db: Session, client: TestClient):
        _seed_data(db, n=10)
        resp = client.get("/api/analysis/timing")
        assert resp.status_code == 200
        data = resp.json()
        assert data["chronotype"] is None

    def test_with_sufficient_data(self, db: Session, client: TestClient):
        _seed_data(db, n=35)
        resp = client.get("/api/analysis/timing")
        assert resp.status_code == 200
        data = resp.json()
        assert data["n_days"] >= 30
        assert data["chronotype"] in ("early", "intermediate", "late")
        assert data["chronotype_confidence"] is not None
        assert data["sleep_midpoint_avg_hour"] is not None


class TestAnalysisNaps:
    def test_empty_db(self, client: TestClient):
        resp = client.get("/api/analysis/naps")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_nap_days"] == 0
        assert data["total_no_nap_days"] == 0
        assert data["segments"] == []
