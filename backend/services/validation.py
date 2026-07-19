"""Soft validation warnings for daily log entries.

These are advisory messages, not hard rejects. Hard limits live in
Pydantic schemas as Field() constraints. Soft warnings flag values
that are technically valid but unusual enough to warrant a heads-up.
"""

from __future__ import annotations

from backend.models import HabitType
from backend.schemas import (
    CaffeineEntryCreate,
    DailyLogCreate,
    HabitEntryCreate,
    NapEntryCreate,
    RedLightEntryCreate,
)


def validate_daily_log(data: DailyLogCreate) -> list[str]:
    """Return soft warning messages for a daily log payload.

    Pure function — no DB dependency.
    """
    warnings: list[str] = []
    warnings.extend(_check_caffeine(data.caffeine_entries))
    warnings.extend(_check_naps(data.nap_entries))
    warnings.extend(_check_habits(data.habit_entries))
    warnings.extend(_check_red_light(data.red_light_entries))
    return warnings


def _check_caffeine(entries: list[CaffeineEntryCreate]) -> list[str]:
    warnings: list[str] = []
    for entry in entries:
        if entry.amount_mg > 400:
            warnings.append(
                f"Caffeine entry of {entry.amount_mg}mg exceeds 400mg single-dose guideline."
            )
    total = sum(e.amount_mg for e in entries)
    if total > 600:
        warnings.append(f"Daily caffeine total of {total}mg exceeds 600mg guideline.")
    return warnings


def _check_naps(entries: list[NapEntryCreate]) -> list[str]:
    warnings: list[str] = []
    for entry in entries:
        if entry.duration_minutes is not None and entry.duration_minutes > 120:
            warnings.append(
                f"Nap of {entry.duration_minutes}min exceeds 120min — "
                "this may impair nighttime sleep."
            )
    return warnings


def _check_habits(entries: list[HabitEntryCreate]) -> list[str]:
    warnings: list[str] = []
    for entry in entries:
        if entry.habit_type == HabitType.EXERCISE:
            if entry.duration_minutes is not None and entry.duration_minutes > 180:
                warnings.append(
                    f"Exercise of {entry.duration_minutes}min exceeds 180min — "
                    "verify this is correct."
                )
        elif entry.habit_type == HabitType.ROOM_TEMP_F:
            if entry.value is not None:
                try:
                    temp = float(entry.value)
                except ValueError:
                    pass
                else:
                    if temp < 60 or temp > 75:
                        warnings.append(
                            f"Room temperature of {temp}°F is outside the optimal "
                            "60-75°F range for sleep."
                        )
        elif entry.habit_type == HabitType.ALCOHOL and entry.value is not None:
            try:
                units = float(entry.value)
            except ValueError:
                pass
            else:
                if units > 6:
                    warnings.append(f"Alcohol intake of {units} units exceeds 6-unit guideline.")
    return warnings


def _check_red_light(entries: list[RedLightEntryCreate]) -> list[str]:
    warnings: list[str] = []
    for entry in entries:
        if entry.duration_minutes is not None and entry.duration_minutes > 30:
            warnings.append(
                f"Red light session of {entry.duration_minutes}min exceeds "
                "30min recommended maximum."
            )
    return warnings
