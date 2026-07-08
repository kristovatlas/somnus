"""Tests for the data export endpoint."""

import csv
import io
import sqlite3
import zipfile
from pathlib import Path

from fastapi.testclient import TestClient

from backend.routers.export import _consistent_sqlite_snapshot


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


# --- CSV formula injection (T-12) ---


def test_export_csv_neutralizes_formula_injection(client: TestClient) -> None:
    """T-12: a leading formula trigger in free text must be quoted so it can't
    execute when the CSV is opened in Excel / Google Sheets."""
    payload = '=HYPERLINK("http://evil","click")'
    client.put(
        "/api/daily-log/2025-06-15",
        json={
            "notes": payload,
            "supplement_entries": [{"name": "@SUM(A1:A9)", "dose_mg": 100}],
        },
    )
    resp = client.get("/api/export?format=csv")
    zf = zipfile.ZipFile(io.BytesIO(resp.content))

    # Parse the CSV so we compare cell *values*, not the raw quoted text.
    daily_rows = list(csv.DictReader(io.StringIO(zf.read("daily_logs.csv").decode())))
    # Data preserved, but the cell now starts with ' so it is inert as a formula
    assert daily_rows[0]["notes"] == "'" + payload
    assert not daily_rows[0]["notes"].startswith("=")

    supp_rows = list(csv.DictReader(io.StringIO(zf.read("supplement_entries.csv").decode())))
    assert supp_rows[0]["name"] == "'@SUM(A1:A9)"


def test_export_csv_leaves_safe_values_untouched(client: TestClient) -> None:
    client.put(
        "/api/daily-log/2025-06-15",
        json={"notes": "Good day", "caffeine_entries": [{"amount_mg": 95, "source": "tea"}]},
    )
    resp = client.get("/api/export?format=csv")
    zf = zipfile.ZipFile(io.BytesIO(resp.content))
    daily_csv = zf.read("daily_logs.csv").decode()
    assert "Good day" in daily_csv
    assert "'Good day" not in daily_csv


# --- Invalid format ---


def test_export_invalid_format(client: TestClient) -> None:
    resp = client.get("/api/export?format=xml")
    assert resp.status_code == 400


# --- SQLite export ---


def test_export_sqlite_responds(client: TestClient) -> None:
    """SQLite export returns either the DB file (200) or 409 if unavailable."""
    resp = client.get("/api/export/sqlite")
    # In CI the default db_path may or may not exist
    assert resp.status_code in (200, 409)
    if resp.status_code == 200:
        assert resp.headers["content-type"] == "application/octet-stream"
        assert "somnus.db" in resp.headers.get("content-disposition", "")


def test_consistent_sqlite_snapshot_is_valid(tmp_path: Path) -> None:
    """T-17: the backup-API snapshot is a valid, internally consistent DB."""
    db_file = tmp_path / "t.db"
    con = sqlite3.connect(str(db_file))
    con.execute("CREATE TABLE t (x INTEGER)")
    con.execute("INSERT INTO t VALUES (42)")
    con.commit()
    con.close()

    data = _consistent_sqlite_snapshot(db_file)
    assert data.startswith(b"SQLite format 3")

    restored = sqlite3.connect(":memory:")
    restored.deserialize(data)
    assert restored.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    assert restored.execute("SELECT x FROM t").fetchone()[0] == 42
    restored.close()
