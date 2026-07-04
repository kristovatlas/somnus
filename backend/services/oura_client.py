"""Oura Ring API v2 client using PAT authentication."""

from __future__ import annotations

import datetime as dt
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class OuraAPIError(Exception):
    """Raised when the Oura API returns a non-success response."""

    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        self.message = message
        super().__init__(message)


class OuraClient:
    """Oura Ring API v2 client using Personal Access Token authentication."""

    def __init__(self, token: str, base_url: str) -> None:
        self._token = token
        self._base_url = base_url.rstrip("/")

    def _get(self, path: str, params: dict[str, str]) -> dict[str, Any]:
        """Make an authenticated GET request to the Oura API."""
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.get(
                    f"{self._base_url}{path}",
                    params=params,
                    headers={"Authorization": f"Bearer {self._token}"},
                )
        except httpx.ConnectError as exc:
            raise OuraAPIError(
                0, "Could not connect to Oura API. Check your internet connection."
            ) from exc

        if resp.status_code == 401:
            raise OuraAPIError(
                401,
                "Oura token is invalid or expired. "
                "Generate a new one at cloud.ouraring.com/personal-access-tokens",
            )
        if resp.status_code == 429:
            raise OuraAPIError(429, "Oura API rate limit reached. Try again in a few minutes.")
        if resp.status_code >= 400:
            raise OuraAPIError(resp.status_code, f"Oura API error (HTTP {resp.status_code})")

        data: dict[str, Any] = resp.json()
        return data

    def get_daily_sleep(self, start_date: dt.date, end_date: dt.date) -> list[dict[str, Any]]:
        """Fetch daily sleep summaries from Oura API v2.

        Returns list of daily sleep objects keyed by 'day'.
        """
        data = self._get(
            "/usercollection/daily_sleep",
            {"start_date": str(start_date), "end_date": str(end_date)},
        )
        items: list[dict[str, Any]] = data.get("data", [])
        return items

    def get_daily_readiness(self, start_date: dt.date, end_date: dt.date) -> list[dict[str, Any]]:
        """Fetch daily readiness scores from Oura API v2."""
        data = self._get(
            "/usercollection/daily_readiness",
            {"start_date": str(start_date), "end_date": str(end_date)},
        )
        items: list[dict[str, Any]] = data.get("data", [])
        return items

    def get_sleep_periods(self, start_date: dt.date, end_date: dt.date) -> list[dict[str, Any]]:
        """Fetch detailed sleep periods (HRV, HR, stages, etc.) from Oura API v2."""
        data = self._get(
            "/usercollection/sleep",
            {"start_date": str(start_date), "end_date": str(end_date)},
        )
        items: list[dict[str, Any]] = data.get("data", [])
        return items


def _seconds_to_minutes(seconds: int | None) -> int | None:
    """Convert seconds to rounded minutes, or None if input is None."""
    if seconds is None:
        return None
    return round(seconds / 60)


def _parse_datetime(value: str | None) -> dt.datetime | None:
    """Parse an ISO 8601 datetime string, or return None."""
    if value is None:
        return None
    # Oura returns formats like "2024-01-15T22:30:00-05:00"
    # fromisoformat handles this in Python 3.11+
    return dt.datetime.fromisoformat(value)


def build_sleep_records(
    daily_sleep: list[dict[str, Any]],
    daily_readiness: list[dict[str, Any]],
    sleep_periods: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Merge Oura API responses into SleepRecord-compatible dicts keyed by date string.

    Each dict contains fields that map directly to SleepRecord columns.
    """
    records: dict[str, dict[str, Any]] = {}

    # Daily sleep → sleep_score
    for item in daily_sleep:
        day = item.get("day")
        if not day:
            continue
        records.setdefault(day, {"date": day})
        records[day]["sleep_score"] = item.get("score")

    # Daily readiness → readiness_score
    for item in daily_readiness:
        day = item.get("day")
        if not day:
            continue
        records.setdefault(day, {"date": day})
        records[day]["readiness_score"] = item.get("score")

    # Sleep periods → detailed metrics
    # Use the "long_sleep" type period (primary sleep, not naps)
    for item in sleep_periods:
        day = item.get("day")
        if not day:
            continue
        # Prefer long_sleep periods; skip naps
        if item.get("type") not in ("long_sleep", None):
            continue
        # If we already have a long_sleep entry for this day, skip duplicates
        if day in records and "total_sleep_minutes" in records[day]:
            continue

        records.setdefault(day, {"date": day})
        rec = records[day]
        rec["total_sleep_minutes"] = _seconds_to_minutes(item.get("total_sleep_duration"))
        rec["rem_minutes"] = _seconds_to_minutes(item.get("rem_sleep_duration"))
        rec["deep_minutes"] = _seconds_to_minutes(item.get("deep_sleep_duration"))
        rec["light_minutes"] = _seconds_to_minutes(item.get("light_sleep_duration"))
        rec["onset_latency_minutes"] = _seconds_to_minutes(item.get("latency"))

        efficiency = item.get("efficiency")
        rec["sleep_efficiency"] = efficiency / 100 if efficiency is not None else None

        rec["avg_hrv"] = item.get("average_hrv")
        rec["lowest_hr"] = item.get("lowest_heart_rate")
        rec["avg_hr"] = item.get("average_heart_rate")
        rec["avg_breath_rate"] = item.get("average_breath")
        rec["bedtime"] = _parse_datetime(item.get("bedtime_start"))
        rec["wake_time"] = _parse_datetime(item.get("bedtime_end"))

    return records
