"""Settings and red light panel API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import RedLightPanel, UserSettings
from backend.schemas import (
    RedLightPanelCreate,
    RedLightPanelOut,
    UserSettingsOut,
    UserSettingsUpdate,
)

router = APIRouter(prefix="/api", tags=["settings"])


# --- User Settings ---


def _get_or_create_settings(db: Session) -> UserSettings:
    """Get singleton settings row, creating if needed."""
    settings = db.get(UserSettings, 1)
    if settings is None:
        settings = UserSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/settings", response_model=UserSettingsOut)
def get_settings(db: Session = Depends(get_db)) -> UserSettingsOut:
    """Get the singleton user settings."""
    settings = _get_or_create_settings(db)
    return UserSettingsOut(
        oura_token_set=settings.oura_token is not None,
        typical_bedtime=settings.typical_bedtime,
        target_wake_time=settings.target_wake_time,
        caffeine_sensitivity=settings.caffeine_sensitivity,
        timezone=settings.timezone,
        chronotype=settings.chronotype,
        zip_code=settings.zip_code,
        age=settings.age,
        display_mode=settings.display_mode,
        circadian_mode_start=settings.circadian_mode_start,
        onboarding_completed=settings.onboarding_completed,
    )


@router.patch("/settings", response_model=UserSettingsOut)
def update_settings(
    data: UserSettingsUpdate,
    db: Session = Depends(get_db),
) -> UserSettingsOut:
    """Partially update user settings."""
    settings = _get_or_create_settings(db)
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return UserSettingsOut(
        oura_token_set=settings.oura_token is not None,
        typical_bedtime=settings.typical_bedtime,
        target_wake_time=settings.target_wake_time,
        caffeine_sensitivity=settings.caffeine_sensitivity,
        timezone=settings.timezone,
        chronotype=settings.chronotype,
        zip_code=settings.zip_code,
        age=settings.age,
        display_mode=settings.display_mode,
        circadian_mode_start=settings.circadian_mode_start,
        onboarding_completed=settings.onboarding_completed,
    )


# --- Red Light Panels ---


@router.get("/red-light-panels", response_model=list[RedLightPanelOut])
def list_panels(db: Session = Depends(get_db)) -> list[RedLightPanelOut]:
    """List all red light panel presets."""
    panels = db.query(RedLightPanel).all()
    return [RedLightPanelOut.model_validate(p) for p in panels]


@router.post("/red-light-panels", response_model=RedLightPanelOut, status_code=201)
def create_panel(
    data: RedLightPanelCreate,
    db: Session = Depends(get_db),
) -> RedLightPanelOut:
    """Create a new red light panel preset."""
    panel = RedLightPanel(**data.model_dump())
    db.add(panel)
    db.commit()
    db.refresh(panel)
    return RedLightPanelOut.model_validate(panel)


@router.get("/red-light-panels/{panel_id}", response_model=RedLightPanelOut)
def get_panel(panel_id: int, db: Session = Depends(get_db)) -> RedLightPanelOut:
    """Get a single red light panel preset."""
    panel = db.get(RedLightPanel, panel_id)
    if panel is None:
        raise HTTPException(status_code=404, detail="Panel not found")
    return RedLightPanelOut.model_validate(panel)


@router.put("/red-light-panels/{panel_id}", response_model=RedLightPanelOut)
def update_panel(
    panel_id: int,
    data: RedLightPanelCreate,
    db: Session = Depends(get_db),
) -> RedLightPanelOut:
    """Update a red light panel preset."""
    panel = db.get(RedLightPanel, panel_id)
    if panel is None:
        raise HTTPException(status_code=404, detail="Panel not found")
    for key, value in data.model_dump().items():
        setattr(panel, key, value)
    db.commit()
    db.refresh(panel)
    return RedLightPanelOut.model_validate(panel)


@router.delete("/red-light-panels/{panel_id}", status_code=204)
def delete_panel(panel_id: int, db: Session = Depends(get_db)) -> None:
    """Delete a red light panel preset."""
    panel = db.get(RedLightPanel, panel_id)
    if panel is None:
        raise HTTPException(status_code=404, detail="Panel not found")
    db.delete(panel)
    db.commit()
