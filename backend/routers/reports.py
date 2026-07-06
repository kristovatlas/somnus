"""Reports API — weekly/monthly summaries and HTML export."""

from __future__ import annotations

from typing import Any

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


def _html_report_response(html: str, filename: str) -> StreamingResponse:
    """Serve a rendered report with T-04 defense-in-depth headers.

    The report renders at the SPA origin via the Vite proxy, so even with
    output escaping a missed injection would reach the whole API. The CSP
    `sandbox` directive puts the document in an opaque origin with script
    execution blocked (the report is static HTML + inline CSS only), and
    the explicit source lists deny everything but the inline stylesheet.
    """
    return StreamingResponse(
        iter([html]),
        media_type="text/html",
        headers={
            "Content-Disposition": f"inline; filename={filename}",
            "Content-Security-Policy": (
                "default-src 'none'; style-src 'unsafe-inline'; "
                "base-uri 'none'; form-action 'none'; sandbox"
            ),
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/weekly", response_model=WeeklyReportResponse)
def weekly_report(
    year: int | None = Query(default=None, ge=1, le=9999),
    week: int | None = Query(default=None, ge=1, le=53),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Get a weekly summary report. Defaults to current ISO week."""
    return get_week_report(db, iso_year=year, iso_week=week)


@router.get("/monthly", response_model=MonthlyReportResponse)
def monthly_report(
    year: int | None = Query(default=None, ge=1, le=9999),
    month: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
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
    return _html_report_response(html, "weekly_report.html")


@router.get("/monthly/export-html", response_model=None)
def monthly_html(
    year: int | None = Query(default=None, ge=1, le=9999),
    month: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Export monthly report as printable HTML."""
    report = get_month_report(db, year=year, month=month)
    html = render_monthly_html(report)
    return _html_report_response(html, "monthly_report.html")
