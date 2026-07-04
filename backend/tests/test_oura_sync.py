"""Tests for Oura Ring sync: OuraClient, build_sleep_records, and sync endpoint."""

from __future__ import annotations

import datetime as dt
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.models import SleepRecord, UserSettings
from backend.routers import oura as oura_router
from backend.services.oura_client import (
    OuraAPIError,
    OuraClient,
    build_sleep_records,
)

# --- Sample Oura API responses ---

SAMPLE_DAILY_SLEEP = {
    "data": [
        {"day": "2026-02-15", "score": 82},
        {"day": "2026-02-16", "score": 75},
    ]
}

SAMPLE_DAILY_READINESS = {
    "data": [
        {"day": "2026-02-15", "score": 88},
        {"day": "2026-02-16", "score": 70},
    ]
}

SAMPLE_SLEEP_PERIODS = {
    "data": [
        {
            "day": "2026-02-15",
            "type": "long_sleep",
            "total_sleep_duration": 27000,  # 450 min = 7.5h
            "rem_sleep_duration": 5400,  # 90 min
            "deep_sleep_duration": 3600,  # 60 min
            "light_sleep_duration": 18000,  # 300 min
            "latency": 600,  # 10 min
            "efficiency": 92,
            "average_hrv": 45.2,
            "lowest_heart_rate": 52,
            "average_heart_rate": 58,
            "average_breath": 15.3,
            "bedtime_start": "2026-02-14T22:30:00-05:00",
            "bedtime_end": "2026-02-15T06:15:00-05:00",
        },
        {
            "day": "2026-02-16",
            "type": "long_sleep",
            "total_sleep_duration": 21600,  # 360 min = 6h
            "rem_sleep_duration": 4800,  # 80 min
            "deep_sleep_duration": 3000,  # 50 min
            "light_sleep_duration": 13800,  # 230 min
            "latency": 900,  # 15 min
            "efficiency": 85,
            "average_hrv": 38.0,
            "lowest_heart_rate": 55,
            "average_heart_rate": 62,
            "average_breath": 16.1,
            "bedtime_start": "2026-02-15T23:00:00-05:00",
            "bedtime_end": "2026-02-16T06:00:00-05:00",
        },
    ]
}


# --- OuraClient unit tests ---


class TestOuraClient:
    """Tests for OuraClient HTTP interactions (mocked)."""

    def test_get_daily_sleep(self) -> None:
        client = OuraClient(token="test-token", base_url="https://api.ouraring.com/v2")
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = SAMPLE_DAILY_SLEEP

        with patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__ = MagicMock(
                return_value=MagicMock(get=MagicMock(return_value=mock_resp))
            )
            mock_http.return_value.__exit__ = MagicMock(return_value=False)
            result = client.get_daily_sleep(dt.date(2026, 2, 15), dt.date(2026, 2, 16))

        assert len(result) == 2
        assert result[0]["score"] == 82

    def test_get_daily_readiness(self) -> None:
        client = OuraClient(token="test-token", base_url="https://api.ouraring.com/v2")
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = SAMPLE_DAILY_READINESS

        with patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__ = MagicMock(
                return_value=MagicMock(get=MagicMock(return_value=mock_resp))
            )
            mock_http.return_value.__exit__ = MagicMock(return_value=False)
            result = client.get_daily_readiness(dt.date(2026, 2, 15), dt.date(2026, 2, 16))

        assert len(result) == 2
        assert result[0]["score"] == 88

    def test_get_sleep_periods(self) -> None:
        client = OuraClient(token="test-token", base_url="https://api.ouraring.com/v2")
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = SAMPLE_SLEEP_PERIODS

        with patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__ = MagicMock(
                return_value=MagicMock(get=MagicMock(return_value=mock_resp))
            )
            mock_http.return_value.__exit__ = MagicMock(return_value=False)
            result = client.get_sleep_periods(dt.date(2026, 2, 15), dt.date(2026, 2, 16))

        assert len(result) == 2
        assert result[0]["total_sleep_duration"] == 27000

    def test_401_raises_oura_api_error(self) -> None:
        client = OuraClient(token="bad-token", base_url="https://api.ouraring.com/v2")
        mock_resp = MagicMock()
        mock_resp.status_code = 401

        with patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__ = MagicMock(
                return_value=MagicMock(get=MagicMock(return_value=mock_resp))
            )
            mock_http.return_value.__exit__ = MagicMock(return_value=False)
            with pytest.raises(OuraAPIError) as exc_info:
                client.get_daily_sleep(dt.date(2026, 2, 15), dt.date(2026, 2, 16))

        assert exc_info.value.status_code == 401
        assert "invalid or expired" in exc_info.value.message

    def test_429_raises_rate_limit_error(self) -> None:
        client = OuraClient(token="test-token", base_url="https://api.ouraring.com/v2")
        mock_resp = MagicMock()
        mock_resp.status_code = 429

        with patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__ = MagicMock(
                return_value=MagicMock(get=MagicMock(return_value=mock_resp))
            )
            mock_http.return_value.__exit__ = MagicMock(return_value=False)
            with pytest.raises(OuraAPIError) as exc_info:
                client.get_daily_sleep(dt.date(2026, 2, 15), dt.date(2026, 2, 16))

        assert exc_info.value.status_code == 429
        assert "rate limit" in exc_info.value.message

    def test_connection_error(self) -> None:
        client = OuraClient(token="test-token", base_url="https://api.ouraring.com/v2")

        with patch("httpx.Client") as mock_http:
            mock_instance = MagicMock()
            mock_instance.get.side_effect = httpx.ConnectError("Connection refused")
            mock_http.return_value.__enter__ = MagicMock(return_value=mock_instance)
            mock_http.return_value.__exit__ = MagicMock(return_value=False)
            with pytest.raises(OuraAPIError) as exc_info:
                client.get_daily_sleep(dt.date(2026, 2, 15), dt.date(2026, 2, 16))

        assert exc_info.value.status_code == 0
        assert "Could not connect" in exc_info.value.message

    def test_sends_bearer_token(self) -> None:
        client = OuraClient(token="my-secret-token", base_url="https://api.ouraring.com/v2")
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": []}

        mock_get = MagicMock(return_value=mock_resp)
        with patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__ = MagicMock(return_value=MagicMock(get=mock_get))
            mock_http.return_value.__exit__ = MagicMock(return_value=False)
            client.get_daily_sleep(dt.date(2026, 2, 15), dt.date(2026, 2, 16))

        call_kwargs = mock_get.call_args
        assert call_kwargs.kwargs["headers"]["Authorization"] == "Bearer my-secret-token"

    def test_constructs_correct_url(self) -> None:
        """Verify the URL passed to httpx uses base_url + path without doubling /v2."""
        client = OuraClient(token="test-token", base_url="https://api.ouraring.com/v2")
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": []}

        mock_get = MagicMock(return_value=mock_resp)
        with patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__ = MagicMock(return_value=MagicMock(get=mock_get))
            mock_http.return_value.__exit__ = MagicMock(return_value=False)
            client.get_daily_sleep(dt.date(2026, 2, 15), dt.date(2026, 2, 16))

        url = mock_get.call_args.args[0]
        assert url == "https://api.ouraring.com/v2/usercollection/daily_sleep"
        assert "/v2/v2/" not in url

    def test_constructs_correct_url_readiness(self) -> None:
        client = OuraClient(token="test-token", base_url="https://api.ouraring.com/v2")
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": []}

        mock_get = MagicMock(return_value=mock_resp)
        with patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__ = MagicMock(return_value=MagicMock(get=mock_get))
            mock_http.return_value.__exit__ = MagicMock(return_value=False)
            client.get_daily_readiness(dt.date(2026, 2, 15), dt.date(2026, 2, 16))

        url = mock_get.call_args.args[0]
        assert url == "https://api.ouraring.com/v2/usercollection/daily_readiness"

    def test_constructs_correct_url_sleep_periods(self) -> None:
        client = OuraClient(token="test-token", base_url="https://api.ouraring.com/v2")
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": []}

        mock_get = MagicMock(return_value=mock_resp)
        with patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__ = MagicMock(return_value=MagicMock(get=mock_get))
            mock_http.return_value.__exit__ = MagicMock(return_value=False)
            client.get_sleep_periods(dt.date(2026, 2, 15), dt.date(2026, 2, 16))

        url = mock_get.call_args.args[0]
        assert url == "https://api.ouraring.com/v2/usercollection/sleep"

    def test_date_chunks_splits_large_range(self) -> None:
        chunks = OuraClient._date_chunks(dt.date(2026, 1, 1), dt.date(2026, 3, 31), 30)
        # 90 days → 3 chunks of 30
        assert len(chunks) == 3
        assert chunks[0] == (dt.date(2026, 1, 1), dt.date(2026, 1, 30))
        assert chunks[1] == (dt.date(2026, 1, 31), dt.date(2026, 3, 1))
        assert chunks[2] == (dt.date(2026, 3, 2), dt.date(2026, 3, 31))

    def test_date_chunks_single_chunk_for_small_range(self) -> None:
        chunks = OuraClient._date_chunks(dt.date(2026, 2, 1), dt.date(2026, 2, 10), 30)
        assert len(chunks) == 1
        assert chunks[0] == (dt.date(2026, 2, 1), dt.date(2026, 2, 10))

    def test_date_chunks_single_day(self) -> None:
        chunks = OuraClient._date_chunks(dt.date(2026, 2, 15), dt.date(2026, 2, 15), 30)
        assert len(chunks) == 1
        assert chunks[0] == (dt.date(2026, 2, 15), dt.date(2026, 2, 15))

    def test_large_range_makes_multiple_api_calls(self) -> None:
        """A 60-day range should produce 2 HTTP request chunks."""
        client = OuraClient(token="test-token", base_url="https://api.ouraring.com/v2")
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": [{"day": "2026-01-15", "score": 80}]}

        mock_get = MagicMock(return_value=mock_resp)
        with patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__ = MagicMock(return_value=MagicMock(get=mock_get))
            mock_http.return_value.__exit__ = MagicMock(return_value=False)
            result = client.get_daily_sleep(dt.date(2026, 1, 1), dt.date(2026, 3, 1))

        # 60 days → 2 chunks → 2 HTTP calls, each returning 1 item
        assert mock_get.call_count == 2
        assert len(result) == 2

    def test_pagination_follows_next_token(self) -> None:
        """When the API returns a next_token, the client should follow it."""
        client = OuraClient(token="test-token", base_url="https://api.ouraring.com/v2")

        page1 = MagicMock()
        page1.status_code = 200
        page1.json.return_value = {
            "data": [{"day": "2026-02-15", "score": 82}],
            "next_token": "abc123",
        }
        page2 = MagicMock()
        page2.status_code = 200
        page2.json.return_value = {
            "data": [{"day": "2026-02-16", "score": 75}],
        }

        mock_get = MagicMock(side_effect=[page1, page2])
        with patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__ = MagicMock(return_value=MagicMock(get=mock_get))
            mock_http.return_value.__exit__ = MagicMock(return_value=False)
            result = client.get_daily_sleep(dt.date(2026, 2, 15), dt.date(2026, 2, 16))

        assert len(result) == 2
        assert mock_get.call_count == 2
        # Second call should include next_token
        second_call_params = mock_get.call_args_list[1].kwargs["params"]
        assert second_call_params["next_token"] == "abc123"

    def test_reuses_one_http_client_across_chunks(self) -> None:
        """All chunks of one endpoint call share a single httpx.Client."""
        client = OuraClient(token="test-token", base_url="https://api.ouraring.com/v2")
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": []}

        mock_get = MagicMock(return_value=mock_resp)
        with patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__ = MagicMock(return_value=MagicMock(get=mock_get))
            mock_http.return_value.__exit__ = MagicMock(return_value=False)
            client.get_daily_sleep(dt.date(2026, 1, 1), dt.date(2026, 3, 1))

        # 60 days → 2 chunk requests over one client (one connection)
        assert mock_get.call_count == 2
        assert mock_http.call_count == 1

    def test_pagination_repeated_token_raises(self) -> None:
        """A server that echoes the same next_token back must not loop forever."""
        client = OuraClient(token="test-token", base_url="https://api.ouraring.com/v2")
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": [], "next_token": "stuck"}

        with patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__ = MagicMock(
                return_value=MagicMock(get=MagicMock(return_value=mock_resp))
            )
            mock_http.return_value.__exit__ = MagicMock(return_value=False)
            with pytest.raises(OuraAPIError) as exc_info:
                client.get_daily_sleep(dt.date(2026, 2, 15), dt.date(2026, 2, 16))

        assert "repeated page token" in exc_info.value.message

    def test_pagination_page_cap_raises(self) -> None:
        """Endless unique page tokens stop at _MAX_PAGES instead of looping forever."""
        client = OuraClient(token="test-token", base_url="https://api.ouraring.com/v2")

        def _page(i: int) -> MagicMock:
            resp = MagicMock()
            resp.status_code = 200
            resp.json.return_value = {"data": [], "next_token": f"tok{i}"}
            return resp

        pages = [_page(i) for i in range(OuraClient._MAX_PAGES + 1)]
        mock_get = MagicMock(side_effect=pages)
        with patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__ = MagicMock(return_value=MagicMock(get=mock_get))
            mock_http.return_value.__exit__ = MagicMock(return_value=False)
            with pytest.raises(OuraAPIError) as exc_info:
                client.get_daily_sleep(dt.date(2026, 2, 15), dt.date(2026, 2, 16))

        assert "too many pages" in exc_info.value.message
        assert mock_get.call_count == OuraClient._MAX_PAGES

    def test_null_data_treated_as_empty(self) -> None:
        """A '"data": null' body is treated as an empty page, not a crash."""
        client = OuraClient(token="test-token", base_url="https://api.ouraring.com/v2")
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": None}

        with patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__ = MagicMock(
                return_value=MagicMock(get=MagicMock(return_value=mock_resp))
            )
            mock_http.return_value.__exit__ = MagicMock(return_value=False)
            result = client.get_daily_sleep(dt.date(2026, 2, 15), dt.date(2026, 2, 16))

        assert result == []

    def test_generic_400_error(self) -> None:
        client = OuraClient(token="test-token", base_url="https://api.ouraring.com/v2")
        mock_resp = MagicMock()
        mock_resp.status_code = 500

        with patch("httpx.Client") as mock_http:
            mock_http.return_value.__enter__ = MagicMock(
                return_value=MagicMock(get=MagicMock(return_value=mock_resp))
            )
            mock_http.return_value.__exit__ = MagicMock(return_value=False)
            with pytest.raises(OuraAPIError) as exc_info:
                client.get_daily_sleep(dt.date(2026, 2, 15), dt.date(2026, 2, 16))

        assert exc_info.value.status_code == 500


# --- build_sleep_records tests ---


class TestBuildSleepRecords:
    """Tests for merging Oura API responses into SleepRecord dicts."""

    def test_full_merge(self) -> None:
        records = build_sleep_records(
            SAMPLE_DAILY_SLEEP["data"],
            SAMPLE_DAILY_READINESS["data"],
            SAMPLE_SLEEP_PERIODS["data"],
        )
        assert "2026-02-15" in records
        assert "2026-02-16" in records

        r = records["2026-02-15"]
        assert r["sleep_score"] == 82
        assert r["readiness_score"] == 88
        assert r["total_sleep_minutes"] == 450
        assert r["rem_minutes"] == 90
        assert r["deep_minutes"] == 60
        assert r["light_minutes"] == 300
        assert r["onset_latency_minutes"] == 10
        assert r["sleep_efficiency"] == pytest.approx(0.92)
        assert r["avg_hrv"] == pytest.approx(45.2)
        assert r["lowest_hr"] == 52
        assert r["avg_hr"] == 58
        assert r["avg_breath_rate"] == pytest.approx(15.3)
        assert r["bedtime"] is not None
        assert r["wake_time"] is not None

    def test_sleep_only_no_readiness(self) -> None:
        records = build_sleep_records(SAMPLE_DAILY_SLEEP["data"], [], SAMPLE_SLEEP_PERIODS["data"])
        r = records["2026-02-15"]
        assert r["sleep_score"] == 82
        assert "readiness_score" not in r

    def test_sleep_only_no_periods(self) -> None:
        records = build_sleep_records(
            SAMPLE_DAILY_SLEEP["data"], SAMPLE_DAILY_READINESS["data"], []
        )
        r = records["2026-02-15"]
        assert r["sleep_score"] == 82
        assert r["readiness_score"] == 88
        assert "total_sleep_minutes" not in r

    def test_empty_data(self) -> None:
        records = build_sleep_records([], [], [])
        assert records == {}

    def test_nap_periods_ignored(self) -> None:
        nap_period = {
            "day": "2026-02-15",
            "type": "rest",
            "total_sleep_duration": 1200,
            "rem_sleep_duration": 0,
            "deep_sleep_duration": 0,
            "light_sleep_duration": 1200,
        }
        records = build_sleep_records(
            SAMPLE_DAILY_SLEEP["data"],
            [],
            [nap_period] + SAMPLE_SLEEP_PERIODS["data"],
        )
        r = records["2026-02-15"]
        # Should use long_sleep, not nap
        assert r["total_sleep_minutes"] == 450

    def test_missing_day_field_skipped(self) -> None:
        records = build_sleep_records([{"score": 80}], [], [])
        assert records == {}

    def test_none_duration_fields(self) -> None:
        period = {
            "day": "2026-02-15",
            "type": "long_sleep",
            "total_sleep_duration": None,
            "rem_sleep_duration": None,
            "deep_sleep_duration": None,
            "light_sleep_duration": None,
            "latency": None,
            "efficiency": None,
            "average_hrv": None,
            "lowest_heart_rate": None,
            "average_heart_rate": None,
            "average_breath": None,
            "bedtime_start": None,
            "bedtime_end": None,
        }
        records = build_sleep_records([], [], [period])
        r = records["2026-02-15"]
        assert r["total_sleep_minutes"] is None
        assert r["sleep_efficiency"] is None
        assert r["bedtime"] is None


# --- Sync endpoint integration tests ---


class TestSyncEndpoint:
    """Tests for GET /api/oura/sync endpoint."""

    def _set_token(self, db: Session, token: str = "valid-token") -> None:
        settings = db.get(UserSettings, 1)
        if settings is None:
            settings = UserSettings(id=1, oura_token=token)
            db.add(settings)
        else:
            settings.oura_token = token
        db.commit()

    def test_sync_no_token_returns_403(self, client: TestClient) -> None:
        resp = client.get("/api/oura/sync")
        assert resp.status_code == 403
        assert "token not configured" in resp.json()["detail"].lower()

    def test_sync_happy_path(self, client: TestClient, db: Session) -> None:
        self._set_token(db)

        with patch("backend.routers.oura.OuraClient") as mock_client:
            instance = mock_client.return_value
            instance.get_daily_sleep.return_value = SAMPLE_DAILY_SLEEP["data"]
            instance.get_daily_readiness.return_value = SAMPLE_DAILY_READINESS["data"]
            instance.get_sleep_periods.return_value = SAMPLE_SLEEP_PERIODS["data"]

            resp = client.get("/api/oura/sync?start_date=2026-02-15&end_date=2026-02-16")

        assert resp.status_code == 200
        data = resp.json()
        assert data["synced_count"] == 2
        assert data["start_date"] == "2026-02-15"
        assert data["end_date"] == "2026-02-16"
        assert data["errors"] == []

        # Verify records were created
        record = db.get(SleepRecord, dt.date(2026, 2, 15))
        assert record is not None
        assert record.sleep_score == 82
        assert record.total_sleep_minutes == 450
        assert record.readiness_score == 88

    def test_sync_upsert_updates_existing(self, client: TestClient, db: Session) -> None:
        self._set_token(db)

        # Create an existing record
        existing = SleepRecord(date=dt.date(2026, 2, 15), sleep_score=50)
        db.add(existing)
        db.commit()

        with patch("backend.routers.oura.OuraClient") as mock_client:
            instance = mock_client.return_value
            instance.get_daily_sleep.return_value = SAMPLE_DAILY_SLEEP["data"]
            instance.get_daily_readiness.return_value = SAMPLE_DAILY_READINESS["data"]
            instance.get_sleep_periods.return_value = SAMPLE_SLEEP_PERIODS["data"]

            resp = client.get("/api/oura/sync?start_date=2026-02-15&end_date=2026-02-16")

        assert resp.status_code == 200
        db.refresh(existing)
        assert existing.sleep_score == 82  # Updated from Oura

    def test_sync_updates_last_oura_sync(self, client: TestClient, db: Session) -> None:
        self._set_token(db)

        with patch("backend.routers.oura.OuraClient") as mock_client:
            instance = mock_client.return_value
            instance.get_daily_sleep.return_value = []
            instance.get_daily_readiness.return_value = []
            instance.get_sleep_periods.return_value = []

            client.get("/api/oura/sync?start_date=2026-02-15&end_date=2026-02-16")

        settings = db.get(UserSettings, 1)
        assert settings is not None
        assert settings.last_oura_sync is not None

    def test_sync_default_dates_uses_last_sync(self, client: TestClient, db: Session) -> None:
        self._set_token(db)
        settings = db.get(UserSettings, 1)
        assert settings is not None
        settings.last_oura_sync = dt.datetime(2026, 2, 10, 12, 0, 0)
        db.commit()

        with patch("backend.routers.oura.OuraClient") as mock_client:
            instance = mock_client.return_value
            instance.get_daily_sleep.return_value = []
            instance.get_daily_readiness.return_value = []
            instance.get_sleep_periods.return_value = []

            resp = client.get("/api/oura/sync")

        data = resp.json()
        assert data["start_date"] == "2026-02-10"

    def test_sync_invalid_token_returns_error(self, client: TestClient, db: Session) -> None:
        self._set_token(db)

        with patch("backend.routers.oura.OuraClient") as mock_client:
            instance = mock_client.return_value
            instance.get_daily_sleep.side_effect = OuraAPIError(
                401,
                "Oura token is invalid or expired. "
                "Generate a new one at cloud.ouraring.com/personal-access-tokens",
            )

            resp = client.get("/api/oura/sync?start_date=2026-02-15&end_date=2026-02-16")

        assert resp.status_code == 401
        assert "invalid or expired" in resp.json()["detail"]

    def test_sync_rate_limit_returns_429(self, client: TestClient, db: Session) -> None:
        self._set_token(db)

        with patch("backend.routers.oura.OuraClient") as mock_client:
            instance = mock_client.return_value
            instance.get_daily_sleep.side_effect = OuraAPIError(
                429, "Oura API rate limit reached. Try again in a few minutes."
            )

            resp = client.get("/api/oura/sync?start_date=2026-02-15&end_date=2026-02-16")

        assert resp.status_code == 429

    def test_sync_partial_data_reports_errors(self, client: TestClient, db: Session) -> None:
        self._set_token(db)

        with patch("backend.routers.oura.OuraClient") as mock_client:
            instance = mock_client.return_value
            instance.get_daily_sleep.return_value = SAMPLE_DAILY_SLEEP["data"]
            instance.get_daily_readiness.side_effect = OuraAPIError(500, "Server error")
            instance.get_sleep_periods.side_effect = OuraAPIError(500, "Server error")

            resp = client.get("/api/oura/sync?start_date=2026-02-15&end_date=2026-02-16")

        assert resp.status_code == 200
        data = resp.json()
        assert data["synced_count"] == 2
        assert len(data["errors"]) == 2

    def test_token_not_in_response(self, client: TestClient, db: Session) -> None:
        """Verify the Oura token value never appears in sync responses."""
        self._set_token(db, token="super-secret-oura-token")

        with patch("backend.routers.oura.OuraClient") as mock_client:
            instance = mock_client.return_value
            instance.get_daily_sleep.return_value = []
            instance.get_daily_readiness.return_value = []
            instance.get_sleep_periods.return_value = []

            resp = client.get("/api/oura/sync?start_date=2026-02-15&end_date=2026-02-16")

        assert "super-secret-oura-token" not in resp.text

    def test_sync_connection_error(self, client: TestClient, db: Session) -> None:
        self._set_token(db)

        with patch("backend.routers.oura.OuraClient") as mock_client:
            instance = mock_client.return_value
            instance.get_daily_sleep.side_effect = OuraAPIError(
                0, "Could not connect to Oura API. Check your internet connection."
            )

            resp = client.get("/api/oura/sync?start_date=2026-02-15&end_date=2026-02-16")

        # 0 falls through to 502
        assert resp.status_code == 502
        assert "Could not connect" in resp.json()["detail"]

    def test_sync_reversed_range_returns_400(self, client: TestClient, db: Session) -> None:
        """An explicit start_date after end_date is an error, not a silent no-op."""
        self._set_token(db)

        with patch("backend.routers.oura.OuraClient") as mock_client:
            resp = client.get("/api/oura/sync?start_date=2026-02-16&end_date=2026-02-15")

        assert resp.status_code == 400
        assert "start_date" in resp.json()["detail"]
        mock_client.assert_not_called()

    def test_sync_clamps_future_last_sync_date(self, client: TestClient, db: Session) -> None:
        """last_oura_sync is stored in UTC, so its date can be "tomorrow" for a
        local evening sync; the derived range must clamp and still hit the API."""
        self._set_token(db)
        settings = db.get(UserSettings, 1)
        assert settings is not None
        today = dt.date.today()
        settings.last_oura_sync = dt.datetime.combine(today + dt.timedelta(days=1), dt.time(0, 30))
        db.commit()

        with patch("backend.routers.oura.OuraClient") as mock_client:
            instance = mock_client.return_value
            instance.get_daily_sleep.return_value = []
            instance.get_daily_readiness.return_value = []
            instance.get_sleep_periods.return_value = []

            resp = client.get("/api/oura/sync")

        assert resp.status_code == 200
        data = resp.json()
        assert data["start_date"] == today.isoformat()
        assert data["end_date"] == today.isoformat()
        # The clamped range still makes a real request, so problems like an
        # invalid token are still surfaced.
        instance.get_daily_sleep.assert_called_once_with(today, today)

    def test_sync_partial_failure_keeps_watermark(self, client: TestClient, db: Session) -> None:
        """A sync with a failed endpoint must not advance last_oura_sync,
        or the failed range would silently never be re-fetched."""
        self._set_token(db)
        settings = db.get(UserSettings, 1)
        assert settings is not None
        previous = dt.datetime(2026, 2, 10, 12, 0, 0)
        settings.last_oura_sync = previous
        db.commit()

        with patch("backend.routers.oura.OuraClient") as mock_client:
            instance = mock_client.return_value
            instance.get_daily_sleep.return_value = SAMPLE_DAILY_SLEEP["data"]
            instance.get_daily_readiness.side_effect = OuraAPIError(500, "Server error")
            instance.get_sleep_periods.return_value = SAMPLE_SLEEP_PERIODS["data"]

            resp = client.get("/api/oura/sync?start_date=2026-02-15&end_date=2026-02-16")

        assert resp.status_code == 200
        data = resp.json()
        assert data["synced_count"] == 2
        assert data["errors"] == ["Could not fetch readiness data"]

        db.expire_all()
        settings = db.get(UserSettings, 1)
        assert settings is not None
        assert settings.last_oura_sync == previous

    def test_sync_conflict_returns_409(self, client: TestClient, db: Session) -> None:
        """Only one sync may run at a time; a concurrent request gets a 409."""
        self._set_token(db)

        assert oura_router._sync_lock.acquire(blocking=False)
        try:
            resp = client.get("/api/oura/sync")
        finally:
            oura_router._sync_lock.release()

        assert resp.status_code == 409
        assert "already in progress" in resp.json()["detail"]
