"""Daily log API routes — composite CRUD + sub-entry factory routes."""

from __future__ import annotations

import datetime as dt
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas import (
    CaffeineEntryOut,
    DailyLogCreate,
    DailyLogOut,
    DailyLogResponse,
    DailyLogSummary,
    HabitEntryOut,
    MealEntryOut,
    NapEntryOut,
    NSDREntryOut,
    PreBedRitualOut,
    RedLightEntryOut,
    SexualActivityOut,
    StimulatingActivityOut,
    SunlightEntryOut,
    SupplementEntryOut,
)
from backend.services.daily_log_service import (
    ENTRY_TYPE_MAP,
    add_sub_entry,
    copy_day,
    delete_daily_log,
    delete_sub_entry,
    get_daily_log,
    has_entries,
    list_daily_logs,
    save_daily_log,
    update_sub_entry,
)
from backend.services.validation import validate_daily_log

router = APIRouter(prefix="/api/daily-log", tags=["daily-log"])

# Map entry_type URL segment → Pydantic Out schema
ENTRY_OUT_MAP: dict[str, type[Any]] = {
    "caffeine": CaffeineEntryOut,
    "meals": MealEntryOut,
    "supplements": SupplementEntryOut,
    "habits": HabitEntryOut,
    "stimulating-activities": StimulatingActivityOut,
    "sexual-activity": SexualActivityOut,
    "pre-bed-rituals": PreBedRitualOut,
    "naps": NapEntryOut,
    "sunlight": SunlightEntryOut,
    "red-light": RedLightEntryOut,
    "nsdr": NSDREntryOut,
}


# --- Composite endpoints ---


@router.put("/{date}", response_model=DailyLogResponse)
def upsert_daily_log(
    date: dt.date,
    data: DailyLogCreate,
    db: Session = Depends(get_db),
) -> DailyLogResponse:
    """Create or replace a daily log with all sub-entries."""
    warnings = validate_daily_log(data)
    log = save_daily_log(db, date, data)
    out = DailyLogOut.model_validate(log)
    return DailyLogResponse(data=out, warnings=warnings)


@router.get("/{date}", response_model=DailyLogOut)
def get_log(
    date: dt.date,
    db: Session = Depends(get_db),
) -> DailyLogOut:
    """Get a single daily log with all entries."""
    log = get_daily_log(db, date)
    if log is None:
        raise HTTPException(status_code=404, detail="Daily log not found")
    return DailyLogOut.model_validate(log)


@router.delete("/{date}", status_code=204)
def delete_log(
    date: dt.date,
    db: Session = Depends(get_db),
) -> None:
    """Delete a daily log and all cascaded entries."""
    if not delete_daily_log(db, date):
        raise HTTPException(status_code=404, detail="Daily log not found")


@router.get("", response_model=list[DailyLogSummary])
def list_logs(
    start_date: dt.date | None = None,
    end_date: dt.date | None = None,
    db: Session = Depends(get_db),
) -> list[DailyLogSummary]:
    """List daily logs with optional date range filter."""
    logs = list_daily_logs(db, start_date=start_date, end_date=end_date)
    return [
        DailyLogSummary(
            date=log.date,
            copied_from_date=log.copied_from_date,
            is_sick=log.is_sick,
            has_entries=has_entries(log),
        )
        for log in logs
    ]


@router.post("/{date}/copy-from/{source_date}", response_model=DailyLogOut)
def copy_log(
    date: dt.date,
    source_date: dt.date,
    db: Session = Depends(get_db),
) -> DailyLogOut:
    """Copy all entries from source_date to target date."""
    log = copy_day(db, date, source_date)
    if log is None:
        raise HTTPException(status_code=404, detail="Source daily log not found")
    return DailyLogOut.model_validate(log)


# --- Sub-entry factory routes ---


def _register_sub_entry_routes(entry_type: str) -> None:
    """Register POST/PUT/DELETE routes for a single entry type."""
    _model_cls, _schema_cls, _rel_name = ENTRY_TYPE_MAP[entry_type]
    out_schema = ENTRY_OUT_MAP[entry_type]

    @router.post(
        f"/{{date}}/{entry_type}",
        response_model=out_schema,
        status_code=201,
        name=f"add_{entry_type.replace('-', '_')}",
    )
    def add_entry(
        date: dt.date,
        data: dict[str, Any],
        db: Session = Depends(get_db),
        _et: str = entry_type,
    ) -> Any:
        try:
            return add_sub_entry(db, date, _et, data)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @router.put(
        f"/{{date}}/{entry_type}/{{entry_id}}",
        response_model=out_schema,
        name=f"update_{entry_type.replace('-', '_')}",
    )
    def update_entry(
        date: dt.date,
        entry_id: int,
        data: dict[str, Any],
        db: Session = Depends(get_db),
        _et: str = entry_type,
    ) -> Any:
        result = update_sub_entry(db, _et, entry_id, data)
        if result is None:
            raise HTTPException(status_code=404, detail="Entry not found")
        return result

    @router.delete(
        f"/{{date}}/{entry_type}/{{entry_id}}",
        status_code=204,
        name=f"delete_{entry_type.replace('-', '_')}",
    )
    def delete_entry(
        date: dt.date,
        entry_id: int,
        db: Session = Depends(get_db),
        _et: str = entry_type,
    ) -> None:
        if not delete_sub_entry(db, _et, entry_id):
            raise HTTPException(status_code=404, detail="Entry not found")


# Register routes for all 11 entry types
for _entry_type in ENTRY_TYPE_MAP:
    _register_sub_entry_routes(_entry_type)
