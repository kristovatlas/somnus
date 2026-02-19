"""Reports API — weekly/monthly summaries and HTML export."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas import MonthlyReportResponse, WeeklyReportResponse
from backend.services.report_service import (
    get_month_report,
    get_week_report,
    render_monthly_html,
    render_weekly_html,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/weekly", response_model=WeeklyReportResponse)
def weekly_report(
    year: int | None = Query(default=None, ge=1, le=9999),
    week: int | None = Query(default=None, ge=1, le=53),
    db: Session = Depends(get_db),
) -> dict:
    """Get a weekly summary report. Defaults to current ISO week."""
    return get_week_report(db, iso_year=year, iso_week=week)


@router.get("/monthly", response_model=MonthlyReportResponse)
def monthly_report(
    year: int | None = Query(default=None, ge=1, le=9999),
    month: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
) -> dict:
    """Get a monthly summary report. Defaults to current month."""
    return get_month_report(db, year=year, month=month)


@router.get("/weekly/export-html", response_model=None)
def weekly_html(
    year: int | None = Query(default=None, ge=1, le=9999),
    week: int | None = Query(default=None, ge=1, le=53),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Export weekly report as printable HTML."""
    report = get_week_report(db, iso_year=year, iso_week=week)
    html = render_weekly_html(report)
    return StreamingResponse(
        iter([html]),
        media_type="text/html",
        headers={"Content-Disposition": "inline; filename=weekly_report.html"},
    )


@router.get("/monthly/export-html", response_model=None)
def monthly_html(
    year: int | None = Query(default=None, ge=1, le=9999),
    month: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Export monthly report as printable HTML."""
    report = get_month_report(db, year=year, month=month)
    html = render_monthly_html(report)
    return StreamingResponse(
        iter([html]),
        media_type="text/html",
        headers={"Content-Disposition": "inline; filename=monthly_report.html"},
    )
