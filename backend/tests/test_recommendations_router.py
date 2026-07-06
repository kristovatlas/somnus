"""Integration tests for recommendations and experiment endpoints."""

import datetime as dt

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.models import (
    CaffeineEntry,
    DailyLog,
    HabitEntry,
    HabitType,
    SleepRecord,
)


def _seed_data(db: Session, n: int = 60) -> None:
    """Seed n days of sleep + daily log data."""
    base = dt.date(2025, 1, 1)
    for i in range(n):
        d = base + dt.timedelta(days=i)
        db.add(
            SleepRecord(
                date=d,
                sleep_score=70 + (i % 20),
                deep_minutes=60 + (i % 15),
                rem_minutes=80 + (i % 10),
                light_minutes=240,
                total_sleep_minutes=400 + i,
                sleep_efficiency=0.88 + (i % 5) * 0.01,
                onset_latency_minutes=8 + (i % 10),
                avg_hrv=40.0 + i * 0.5,
                bedtime=dt.datetime.combine(d - dt.timedelta(days=1), dt.time(22, 30)),
                wake_time=dt.datetime.combine(d, dt.time(6, 30)),
            )
        )
        db.add(DailyLog(date=d))
        db.add(
            CaffeineEntry(
                date=d,
                time=dt.time(8, 0),
                amount_mg=100 + i * 5,
                source="drip_coffee",
            )
        )
        db.add(
            HabitEntry(
                date=d,
                habit_type=HabitType.STRESS_LEVEL,
                value=str(3 + (i % 5)),
            )
        )
    db.commit()


class TestGetRecommendations:
    def test_empty_db(self, client: TestClient) -> None:
        resp = client.get("/api/recommendations")
        assert resp.status_code == 200
        data = resp.json()
        assert data["has_sufficient_data"] is False
        assert data["recommendations"] == []
        assert data["total_days"] == 0

    def test_with_data(self, db: Session, client: TestClient) -> None:
        _seed_data(db, n=60)
        resp = client.get("/api/recommendations")
        assert resp.status_code == 200
        data = resp.json()
        assert data["has_sufficient_data"] is True
        assert data["total_days"] >= 50
        assert isinstance(data["recommendations"], list)

    def test_schema_validation(self, db: Session, client: TestClient) -> None:
        _seed_data(db, n=60)
        resp = client.get("/api/recommendations")
        assert resp.status_code == 200
        data = resp.json()
        for rec in data["recommendations"]:
            assert isinstance(rec["id"], str)
            assert isinstance(rec["category"], str)
            assert isinstance(rec["priority"], int)
            assert isinstance(rec["title"], str)
            assert isinstance(rec["body"], str)
            assert isinstance(rec["factor"], str)
            assert isinstance(rec["factor_label"], str)


class TestExperimentCRUD:
    def test_create_experiment(self, client: TestClient) -> None:
        resp = client.post(
            "/api/experiments",
            json={
                "factor": "total_caffeine_mg",
                "hypothesis": "Reducing caffeine will help",
                "start_date": "2027-03-01",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["factor"] == "total_caffeine_mg"
        assert data["hypothesis"] == "Reducing caffeine will help"
        assert data["start_date"] == "2027-03-01"
        assert data["end_date"] == "2027-03-15"
        assert data["status"] == "active"

    def test_create_hypothesis_too_long_422(self, client: TestClient) -> None:
        # T-04: hypothesis is rendered into the monthly HTML report — bounded
        resp = client.post(
            "/api/experiments",
            json={
                "factor": "total_caffeine_mg",
                "hypothesis": "x" * 501,
                "start_date": "2027-03-01",
            },
        )
        assert resp.status_code == 422

    def test_create_hypothesis_at_length_bound(self, client: TestClient) -> None:
        resp = client.post(
            "/api/experiments",
            json={
                "factor": "total_caffeine_mg",
                "hypothesis": "x" * 500,
                "start_date": "2027-03-01",
            },
        )
        assert resp.status_code == 201

    @pytest.mark.parametrize(
        "factor",
        ["not_a_real_variable", '<img src=x onerror="alert(1)">', ""],
    )
    def test_create_unknown_factor_422(self, client: TestClient, factor: str) -> None:
        # T-04: factor is an enum of analyzable variables, not free text —
        # an unknown value would become the active experiment's report label
        resp = client.post(
            "/api/experiments",
            json={
                "factor": factor,
                "hypothesis": "h",
                "start_date": "2027-03-01",
            },
        )
        assert resp.status_code == 422

    def test_create_social_jet_lag_factor_accepted(self, client: TestClient) -> None:
        # social_jet_lag is a derived factor the recommender emits — it must
        # pass factor validation like any data-column variable
        resp = client.post(
            "/api/experiments",
            json={
                "factor": "social_jet_lag",
                "hypothesis": "Aligning weekend bedtime will improve sleep",
                "start_date": "2027-03-01",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["factor_label"] == "Social Jet Lag"

    def test_create_conflict_409(self, client: TestClient) -> None:
        # Create first (future dates so it stays active)
        client.post(
            "/api/experiments",
            json={
                "factor": "total_caffeine_mg",
                "hypothesis": "Test 1",
                "start_date": "2027-03-01",
            },
        )
        # Try to create second
        resp = client.post(
            "/api/experiments",
            json={
                "factor": "exercise_done",
                "hypothesis": "Test 2",
                "start_date": "2027-03-01",
            },
        )
        assert resp.status_code == 409

    def test_get_experiment(self, client: TestClient) -> None:
        create_resp = client.post(
            "/api/experiments",
            json={
                "factor": "exercise_done",
                "hypothesis": "More exercise helps",
                "start_date": "2027-03-01",
                "end_date": "2027-03-14",
            },
        )
        exp_id = create_resp.json()["id"]

        resp = client.get(f"/api/experiments/{exp_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == exp_id
        assert data["factor"] == "exercise_done"

    def test_get_experiment_not_found(self, client: TestClient) -> None:
        resp = client.get("/api/experiments/999")
        assert resp.status_code == 404

    def test_list_experiments(self, client: TestClient) -> None:
        client.post(
            "/api/experiments",
            json={
                "factor": "total_caffeine_mg",
                "hypothesis": "Test",
                "start_date": "2027-03-01",
            },
        )
        resp = client.get("/api/experiments")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1

    def test_update_status(self, client: TestClient) -> None:
        create_resp = client.post(
            "/api/experiments",
            json={
                "factor": "total_caffeine_mg",
                "hypothesis": "Test",
                "start_date": "2027-03-01",
            },
        )
        exp_id = create_resp.json()["id"]

        resp = client.patch(
            f"/api/experiments/{exp_id}",
            json={
                "status": "abandoned",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "abandoned"

    def test_update_notes(self, client: TestClient) -> None:
        create_resp = client.post(
            "/api/experiments",
            json={
                "factor": "total_caffeine_mg",
                "hypothesis": "Test",
                "start_date": "2027-03-01",
            },
        )
        exp_id = create_resp.json()["id"]

        resp = client.patch(
            f"/api/experiments/{exp_id}",
            json={
                "notes": "Day 3: feeling more rested",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["notes"] == "Day 3: feeling more rested"

    def test_update_not_found(self, client: TestClient) -> None:
        resp = client.patch("/api/experiments/999", json={"status": "abandoned"})
        assert resp.status_code == 404

    def test_experiment_with_computed_metrics(self, db: Session, client: TestClient) -> None:
        """Create experiment with surrounding sleep data and verify metrics."""
        base = dt.date(2025, 3, 1)
        # Baseline data
        for i in range(14):
            d = base - dt.timedelta(days=14) + dt.timedelta(days=i)
            db.add(
                SleepRecord(
                    date=d,
                    sleep_score=75,
                    deep_minutes=65,
                    rem_minutes=85,
                    avg_hrv=42.0,
                )
            )
        # Result data
        for i in range(7):
            d = base + dt.timedelta(days=i)
            db.add(
                SleepRecord(
                    date=d,
                    sleep_score=82,
                    deep_minutes=72,
                    rem_minutes=92,
                    avg_hrv=48.0,
                )
            )
        db.commit()

        create_resp = client.post(
            "/api/experiments",
            json={
                "factor": "total_caffeine_mg",
                "hypothesis": "Reducing caffeine",
                "start_date": "2025-03-01",
                "end_date": "2025-03-14",
            },
        )
        exp_id = create_resp.json()["id"]

        resp = client.get(f"/api/experiments/{exp_id}")
        data = resp.json()
        assert data["baseline_sleep_score"] == 75.0
        assert data["result_sleep_score"] == 82.0
        assert data["days_completed"] == 7


class TestDashboardTopRecommendations:
    def test_present_when_data(self, db: Session, client: TestClient) -> None:
        _seed_data(db, n=60)
        resp = client.get("/api/dashboard")
        assert resp.status_code == 200
        data = resp.json()
        assert "top_recommendations" in data

    def test_empty_when_insufficient(self, client: TestClient) -> None:
        resp = client.get("/api/dashboard")
        assert resp.status_code == 200
        data = resp.json()
        assert data["top_recommendations"] == []
