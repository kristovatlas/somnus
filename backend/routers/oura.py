"""Oura Ring sync API route."""

from __future__ import annotations

import datetime as dt
import logging
import threading

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.config import settings as app_settings
from backend.database import get_db
from backend.models import SleepRecord, UserSettings
from backend.schemas import OuraSyncResponse
from backend.security import require_json_content_type
from backend.services.oura_client import OuraAPIError, OuraClient, build_sleep_records

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["oura"])

# A chunked sync can take a while; a second sync started meanwhile would
# race the first on the same SleepRecord rows, so only one runs at a time.
_sync_lock = threading.Lock()


def _get_settings(db: Session) -> UserSettings:
    """Load the singleton UserSettings row."""
    settings = db.get(UserSettings, 1)
    if settings is None:
        settings = UserSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.post(
    "/oura/sync",
    response_model=OuraSyncResponse,
    dependencies=[Depends(require_json_content_type)],
)
def sync_oura(
    start_date: dt.date | None = Query(default=None),
    end_date: dt.date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> OuraSyncResponse:
    """Sync sleep data from the Oura Ring API.

    Fetches daily sleep, readiness, and detailed sleep period data
    for the given date range, then upserts into SleepRecord table.

    T-02: this is a state-changer (upserts records, spends the Oura token),
    so it is a POST guarded by ``require_json_content_type`` — a cross-site
    simple GET/form-POST can no longer trigger it.
    """
    if not _sync_lock.acquire(blocking=False):
        raise HTTPException(
            status_code=409,
            detail="An Oura sync is already in progress. Wait for it to finish.",
        )
    try:
        return _run_sync(start_date, end_date, db)
    finally:
        _sync_lock.release()


def _run_sync(
    start_date: dt.date | None,
    end_date: dt.date | None,
    db: Session,
) -> OuraSyncResponse:
    """Perform the sync. Caller must hold _sync_lock."""
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
            # last_oura_sync is stored in UTC, so its calendar date can be
            # ahead of the local date in the evening; clamp so the derived
            # range stays valid instead of silently fetching nothing.
            start_date = min(settings.last_oura_sync.date(), end_date)
        else:
            start_date = today - dt.timedelta(days=365)
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date must be on or before end_date.",
        )

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

    # Advance the sync watermark only when every endpoint succeeded. A
    # partial sync must be re-fetched next time — otherwise the failed
    # range would be skipped forever and its NULLs would read as "not
    # recorded" (see ADR 003).
    if not errors:
        settings.last_oura_sync = dt.datetime.now(dt.UTC)
    db.commit()

    return OuraSyncResponse(
        synced_count=synced_count,
        start_date=start_date,
        end_date=end_date,
        errors=errors,
    )
