"""Dashboard endpoint — aggregated sleep overview data."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.schemas import DashboardResponse
from backend.services.dashboard_service import get_dashboard_data

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(db: Session = Depends(get_db)) -> DashboardResponse:
    """Return aggregated dashboard data in a single BFF response."""
    data = get_dashboard_data(db)
    return DashboardResponse(**data)
