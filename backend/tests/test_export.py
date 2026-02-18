"""Tests for the data export endpoint."""

import io
import zipfile

from fastapi.testclient import TestClient


def _seed_data(client: TestClient) -> None:
    """Create some test data for export."""
    client.put(
        "/api/daily-log/2025-06-15",
        json={
            "is_sick": False,
            "notes": "Good day",
            "caffeine_entries": [
                {"amount_mg": 95, "source": "drip_coffee"},
                {"amount_mg": 40, "source": "tea"},
            ],
            "nap_entries": [{"duration_minutes": 20}],
        },
    )
    client.put(
        "/api/daily-log/2025-06-16",
        json={"is_sick": True},
    )


# --- JSON export ---


def test_export_json_empty(client: TestClient) -> None:
    resp = client.get("/api/export?format=json")
    assert resp.status_code == 200
    data = resp.json()
    assert data["daily_logs"] == []
    assert data["sleep_records"] == []


def test_export_json_with_data(client: TestClient) -> None:
    _seed_data(client)
    resp = client.get("/api/export?format=json")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["daily_logs"]) == 2
    assert len(data["daily_logs"][0]["caffeine_entries"]) == 2


def test_export_json_with_date_range(client: TestClient) -> None:
    _seed_data(client)
    resp = client.get("/api/export?format=json&start_date=2025-06-16&end_date=2025-06-16")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["daily_logs"]) == 1
    assert data["daily_logs"][0]["date"] == "2025-06-16"


# --- CSV export ---


def test_export_csv_empty(client: TestClient) -> None:
    resp = client.get("/api/export?format=csv")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/zip"
    zf = zipfile.ZipFile(io.BytesIO(resp.content))
    assert "daily_logs.csv" in zf.namelist()
    assert "sleep_records.csv" in zf.namelist()


def test_export_csv_with_data(client: TestClient) -> None:
    _seed_data(client)
    resp = client.get("/api/export?format=csv")
    assert resp.status_code == 200
    zf = zipfile.ZipFile(io.BytesIO(resp.content))
    names = zf.namelist()

    # Should have CSVs for all tables
    assert "daily_logs.csv" in names
    assert "caffeine_entries.csv" in names
    assert "nap_entries.csv" in names

    # Check daily_logs.csv content
    daily_csv = zf.read("daily_logs.csv").decode()
    assert "2025-06-15" in daily_csv
    assert "2025-06-16" in daily_csv

    # Check caffeine CSV has data rows
    caffeine_csv = zf.read("caffeine_entries.csv").decode()
    lines = caffeine_csv.strip().split("\n")
    assert len(lines) == 3  # header + 2 entries


def test_export_csv_with_date_range(client: TestClient) -> None:
    _seed_data(client)
    resp = client.get("/api/export?format=csv&start_date=2025-06-15&end_date=2025-06-15")
    assert resp.status_code == 200
    zf = zipfile.ZipFile(io.BytesIO(resp.content))
    daily_csv = zf.read("daily_logs.csv").decode()
    assert "2025-06-15" in daily_csv
    assert "2025-06-16" not in daily_csv


# --- Invalid format ---


def test_export_invalid_format(client: TestClient) -> None:
    resp = client.get("/api/export?format=xml")
    assert resp.status_code == 400
