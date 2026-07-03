"""Oura Ring sync API route."""

from __future__ import annotations

import datetime as dt
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.config import settings as app_settings
from backend.database import get_db
from backend.models import SleepRecord, UserSettings
from backend.schemas import OuraSyncResponse
from backend.services.oura_client import OuraAPIError, OuraClient, build_sleep_records

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["oura"])


def _get_settings(db: Session) -> UserSettings:
    """Load the singleton UserSettings row."""
    settings = db.get(UserSettings, 1)
    if settings is None:
        settings = UserSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/oura/sync", response_model=OuraSyncResponse)
def sync_oura(
    start_date: dt.date | None = Query(default=None),
    end_date: dt.date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> OuraSyncResponse:
    """Sync sleep data from the Oura Ring API.

    Fetches daily sleep, readiness, and detailed sleep period data
    for the given date range, then upserts into SleepRecord table.
    """
    settings = _get_settings(db)

    if not settings.oura_token:
        raise HTTPException(
            status_code=403,
            detail="Oura token not configured. Add your token in Settings.",
        )

    today = dt.date.today()
    if end_date is None:
        end_date = today
    if start_date is None:
        if settings.last_oura_sync:
            start_date = settings.last_oura_sync.date()
        else:
            start_date = today - dt.timedelta(days=365)

    client = OuraClient(
        token=settings.oura_token,
        base_url=app_settings.oura_api_base_url,
    )

    errors: list[str] = []

    try:
        daily_sleep = client.get_daily_sleep(start_date, end_date)
    except OuraAPIError as e:
        raise HTTPException(status_code=e.status_code or 502, detail=e.message) from e

    try:
        daily_readiness = client.get_daily_readiness(start_date, end_date)
    except OuraAPIError:
        daily_readiness = []
        errors.append("Could not fetch readiness data")

    try:
        sleep_periods = client.get_sleep_periods(start_date, end_date)
    except OuraAPIError:
        sleep_periods = []
        errors.append("Could not fetch detailed sleep period data")

    merged = build_sleep_records(daily_sleep, daily_readiness, sleep_periods)

    synced_count = 0
    for day_str, record_data in merged.items():
        date_val = dt.date.fromisoformat(day_str)
        existing = db.get(SleepRecord, date_val)
        if existing:
            for key, value in record_data.items():
                if key != "date":
                    setattr(existing, key, value)
        else:
            record_data["date"] = date_val
            db.add(SleepRecord(**record_data))
        synced_count += 1

    settings.last_oura_sync = dt.datetime.now(dt.UTC)
    db.commit()

    return OuraSyncResponse(
        synced_count=synced_count,
        start_date=start_date,
        end_date=end_date,
        errors=errors,
    )
