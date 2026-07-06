"""Tests for the reports router endpoints."""

from __future__ import annotations

import datetime as dt

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.models import DailyLog, SleepRecord


def _seed_week(client: TestClient, db: Session) -> None:
    """Add records for ISO week 8, 2026 (Feb 16-22)."""
    for i in range(5):
        d = dt.date(2026, 2, 16 + i)
        db.add(
            SleepRecord(
                date=d,
                sleep_score=80 + i,
                avg_hrv=40.0 + i,
                deep_minutes=60 + i * 2,
                rem_minutes=85 + i,
                bedtime=dt.datetime(d.year, d.month, d.day - 1, 22, 30),
                wake_time=dt.datetime(d.year, d.month, d.day, 6, 30),
            )
        )
        db.add(DailyLog(date=d))
    db.commit()


class TestWeeklyReportEndpoint:
    def test_default_params(self, client: TestClient) -> None:
        resp = client.get("/api/reports/weekly")
        assert resp.status_code == 200
        data = resp.json()
        assert "iso_year" in data
        assert "iso_week" in data
        assert "has_insufficient_data" in data

    def test_explicit_params(self, client: TestClient, db: Session) -> None:
        _seed_week(client, db)
        resp = client.get("/api/reports/weekly?year=2026&week=8")
        assert resp.status_code == 200
        data = resp.json()
        assert data["iso_year"] == 2026
        assert data["iso_week"] == 8
        assert data["days_with_data"] == 5

    def test_invalid_week(self, client: TestClient) -> None:
        resp = client.get("/api/reports/weekly?year=2026&week=0")
        assert resp.status_code == 422

    def test_invalid_week_too_high(self, client: TestClient) -> None:
        resp = client.get("/api/reports/weekly?year=2026&week=54")
        assert resp.status_code == 422


class TestMonthlyReportEndpoint:
    def test_default_params(self, client: TestClient) -> None:
        resp = client.get("/api/reports/monthly")
        assert resp.status_code == 200
        data = resp.json()
        assert "year" in data
        assert "month" in data

    def test_explicit_params(self, client: TestClient, db: Session) -> None:
        for i in range(5):
            d = dt.date(2026, 2, 1 + i)
            db.add(SleepRecord(date=d, sleep_score=80))
        db.commit()
        resp = client.get("/api/reports/monthly?year=2026&month=2")
        assert resp.status_code == 200
        data = resp.json()
        assert data["year"] == 2026
        assert data["month"] == 2

    def test_invalid_month(self, client: TestClient) -> None:
        resp = client.get("/api/reports/monthly?year=2026&month=0")
        assert resp.status_code == 422

    def test_invalid_month_too_high(self, client: TestClient) -> None:
        resp = client.get("/api/reports/monthly?year=2026&month=13")
        assert resp.status_code == 422


class TestWeeklyHTMLExport:
    def test_content_type(self, client: TestClient) -> None:
        resp = client.get("/api/reports/weekly/export-html")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]

    def test_content_disposition(self, client: TestClient) -> None:
        resp = client.get("/api/reports/weekly/export-html")
        assert "weekly_report.html" in resp.headers.get("content-disposition", "")

    def test_contains_html(self, client: TestClient, db: Session) -> None:
        _seed_week(client, db)
        resp = client.get("/api/reports/weekly/export-html?year=2026&week=8")
        assert "<!DOCTYPE html>" in resp.text
        assert "Weekly Report" in resp.text


class TestMonthlyHTMLExport:
    def test_content_type(self, client: TestClient) -> None:
        resp = client.get("/api/reports/monthly/export-html")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]

    def test_content_disposition(self, client: TestClient) -> None:
        resp = client.get("/api/reports/monthly/export-html")
        assert "monthly_report.html" in resp.headers.get("content-disposition", "")

    def test_contains_html(self, client: TestClient) -> None:
        resp = client.get("/api/reports/monthly/export-html?year=2026&month=2")
        assert "<!DOCTYPE html>" in resp.text
        assert "Monthly Report" in resp.text


class TestHTMLExportSecurityHeaders:
    """T-04 defense-in-depth: reports render at the SPA origin via the proxy,
    so the response must carry a script-blocking, origin-isolating CSP."""

    @pytest.mark.parametrize(
        "url",
        ["/api/reports/weekly/export-html", "/api/reports/monthly/export-html"],
    )
    def test_csp_sandbox(self, client: TestClient, url: str) -> None:
        resp = client.get(url)
        csp = resp.headers.get("content-security-policy", "")
        assert "default-src 'none'" in csp
        assert "sandbox" in csp
        # frame-ancestors does not fall back to default-src — without it any
        # page could iframe the health report (UI redress)
        assert "frame-ancestors 'none'" in csp
        assert resp.headers.get("x-content-type-options") == "nosniff"

    def test_monthly_export_escapes_stored_hypothesis(
        self, client: TestClient, db: Session
    ) -> None:
        """End-to-end T-04: a hostile hypothesis stored via the API must not
        reach the rendered monthly report unescaped."""
        # Enough records that the report takes the full path (which includes
        # the active experiment), not the insufficient-data early return
        _seed_week(client, db)
        payload = "<script>fetch('/api/export/sqlite')</script>"
        resp = client.post(
            "/api/experiments",
            json={
                "factor": "total_caffeine_mg",
                "hypothesis": payload,
                "start_date": "2027-03-01",
            },
        )
        assert resp.status_code == 201
        resp = client.get("/api/reports/monthly/export-html?year=2026&month=2")
        assert resp.status_code == 200
        assert payload not in resp.text
        assert "&lt;script&gt;" in resp.text
