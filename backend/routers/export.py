"""Data export API route — JSON, CSV (zip), and SQLite formats."""

from __future__ import annotations

import csv
import datetime as dt
import io
import shutil
import zipfile
from collections.abc import Sequence

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.config import settings as app_settings
from backend.database import get_db
from backend.models import SleepRecord
from backend.schemas import DailyLogOut, ExportData, SleepRecordOut
from backend.services.daily_log_service import list_daily_logs

router = APIRouter(prefix="/api", tags=["export"])


@router.get("/export", response_model=None)
def export_data(
    format: str = "json",
    start_date: dt.date | None = None,
    end_date: dt.date | None = None,
    db: Session = Depends(get_db),
) -> ExportData | StreamingResponse:
    """Export data as JSON or CSV zip."""
    if format not in ("json", "csv"):
        raise HTTPException(status_code=400, detail="Format must be 'json' or 'csv'")

    logs = list_daily_logs(db, start_date=start_date, end_date=end_date)
    daily_logs_out = [DailyLogOut.model_validate(log) for log in logs]

    sleep_query = db.query(SleepRecord)
    if start_date is not None:
        sleep_query = sleep_query.filter(SleepRecord.date >= start_date)
    if end_date is not None:
        sleep_query = sleep_query.filter(SleepRecord.date <= end_date)
    sleep_records = [SleepRecordOut.model_validate(r) for r in sleep_query.all()]

    if format == "json":
        return ExportData(daily_logs=daily_logs_out, sleep_records=sleep_records)

    # CSV zip
    return _build_csv_zip(daily_logs_out, sleep_records)


def _build_csv_zip(
    daily_logs: list[DailyLogOut],
    sleep_records: list[SleepRecordOut],
) -> StreamingResponse:
    """Build a zip file containing one CSV per table."""
    buf = io.BytesIO()

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Daily logs summary
        zf.writestr(
            "daily_logs.csv",
            _to_csv(
                daily_logs,
                [
                    "date",
                    "copied_from_date",
                    "is_sick",
                    "notes",
                ],
            ),
        )

        # Sleep records
        zf.writestr(
            "sleep_records.csv",
            _to_csv(
                sleep_records,
                [
                    "date",
                    "total_sleep_minutes",
                    "rem_minutes",
                    "deep_minutes",
                    "light_minutes",
                    "rem_pct",
                    "deep_pct",
                    "light_pct",
                    "sleep_efficiency",
                    "onset_latency_minutes",
                    "avg_hrv",
                    "lowest_hr",
                    "avg_hr",
                    "avg_breath_rate",
                    "readiness_score",
                    "sleep_score",
                    "bedtime",
                    "wake_time",
                ],
            ),
        )

        # Sub-entry CSVs
        _entry_types = [
            (
                "caffeine_entries",
                [
                    "id",
                    "date",
                    "time",
                    "amount_mg",
                    "source",
                ],
            ),
            (
                "meal_entries",
                [
                    "id",
                    "date",
                    "time",
                    "is_last_meal",
                    "notes",
                ],
            ),
            (
                "supplement_entries",
                [
                    "id",
                    "date",
                    "time",
                    "name",
                    "dose_mg",
                ],
            ),
            (
                "habit_entries",
                [
                    "id",
                    "date",
                    "habit_type",
                    "time",
                    "value",
                    "duration_minutes",
                    "notes",
                ],
            ),
            (
                "stimulating_activity_entries",
                [
                    "id",
                    "date",
                    "end_time",
                    "activity_type",
                    "duration_minutes",
                ],
            ),
            (
                "pre_bed_ritual_entries",
                [
                    "id",
                    "date",
                    "time",
                    "ritual_type",
                    "duration_minutes",
                ],
            ),
            (
                "nap_entries",
                [
                    "id",
                    "date",
                    "start_time",
                    "end_time",
                    "duration_minutes",
                ],
            ),
            (
                "sunlight_entries",
                [
                    "id",
                    "date",
                    "start_time",
                    "duration_minutes",
                    "estimated_lux",
                    "notes",
                ],
            ),
            (
                "red_light_entries",
                [
                    "id",
                    "date",
                    "panel_id",
                    "start_time",
                    "duration_minutes",
                    "dose_joules_cm2",
                ],
            ),
            (
                "nsdr_entries",
                [
                    "id",
                    "date",
                    "time",
                    "duration_minutes",
                    "nsdr_type",
                ],
            ),
        ]

        for attr_name, fields in _entry_types:
            all_entries = []
            for log in daily_logs:
                entries = getattr(log, attr_name)
                if isinstance(entries, list):
                    all_entries.extend(entries)
            zf.writestr(f"{attr_name}.csv", _to_csv(all_entries, fields))

        # Sexual activity (singular relationship)
        sexual_entries = [
            log.sexual_activity_entry for log in daily_logs if log.sexual_activity_entry is not None
        ]
        zf.writestr(
            "sexual_activity_entries.csv",
            _to_csv(
                sexual_entries,
                ["id", "date", "time", "activity_type"],
            ),
        )

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=somnus_export.zip"},
    )


@router.get("/export/sqlite", response_model=None)
def export_sqlite() -> StreamingResponse:
    """Export the raw SQLite database file."""
    db_path = app_settings.db_path
    if str(db_path) == ":memory:" or not db_path.exists():
        raise HTTPException(
            status_code=409, detail="SQLite export unavailable in this environment"
        )
    buf = io.BytesIO()
    with open(db_path, "rb") as f:
        shutil.copyfileobj(f, buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/octet-stream",
        headers={"Content-Disposition": "attachment; filename=somnus.db"},
    )


def _to_csv(items: Sequence[object], fields: list[str]) -> str:
    """Convert a list of Pydantic models to CSV string."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(fields)
    for item in items:
        row = []
        for f in fields:
            val = getattr(item, f, None)
            row.append("" if val is None else str(val))
        writer.writerow(row)
    return output.getvalue()
