"""Tests for soft validation warnings."""

from backend.models import CaffeineSource, HabitType
from backend.schemas import (
    CaffeineEntryCreate,
    DailyLogCreate,
    HabitEntryCreate,
    NapEntryCreate,
    RedLightEntryCreate,
)
from backend.services.validation import validate_daily_log


def _log(**kwargs: object) -> DailyLogCreate:
    return DailyLogCreate(**kwargs)  # type: ignore[arg-type]


# --- Caffeine ---


def test_caffeine_single_dose_warning() -> None:
    log = _log(caffeine_entries=[CaffeineEntryCreate(amount_mg=450, source=CaffeineSource.OTHER)])
    warnings = validate_daily_log(log)
    assert any("450mg exceeds 400mg" in w for w in warnings)


def test_caffeine_single_dose_at_limit_no_warning() -> None:
    log = _log(caffeine_entries=[CaffeineEntryCreate(amount_mg=400, source=CaffeineSource.OTHER)])
    warnings = validate_daily_log(log)
    assert not any("single-dose" in w for w in warnings)


def test_caffeine_daily_total_warning() -> None:
    entries = [
        CaffeineEntryCreate(amount_mg=300, source=CaffeineSource.DRIP_COFFEE),
        CaffeineEntryCreate(amount_mg=200, source=CaffeineSource.DRIP_COFFEE),
        CaffeineEntryCreate(amount_mg=150, source=CaffeineSource.TEA),
    ]
    log = _log(caffeine_entries=entries)
    warnings = validate_daily_log(log)
    assert any("650mg exceeds 600mg" in w for w in warnings)


def test_caffeine_daily_total_at_limit_no_warning() -> None:
    entries = [
        CaffeineEntryCreate(amount_mg=300, source=CaffeineSource.DRIP_COFFEE),
        CaffeineEntryCreate(amount_mg=300, source=CaffeineSource.TEA),
    ]
    log = _log(caffeine_entries=entries)
    warnings = validate_daily_log(log)
    assert not any("daily" in w.lower() for w in warnings)


def test_no_caffeine_no_warnings() -> None:
    log = _log()
    assert validate_daily_log(log) == []


# --- Naps ---


def test_nap_over_120_warning() -> None:
    log = _log(nap_entries=[NapEntryCreate(duration_minutes=150)])
    warnings = validate_daily_log(log)
    assert any("150min exceeds 120min" in w for w in warnings)


def test_nap_at_120_no_warning() -> None:
    log = _log(nap_entries=[NapEntryCreate(duration_minutes=120)])
    assert validate_daily_log(log) == []


def test_nap_none_duration_no_warning() -> None:
    log = _log(nap_entries=[NapEntryCreate()])
    assert validate_daily_log(log) == []


# --- Exercise ---


def test_exercise_over_180_warning() -> None:
    log = _log(
        habit_entries=[HabitEntryCreate(habit_type=HabitType.EXERCISE, duration_minutes=200)]
    )
    warnings = validate_daily_log(log)
    assert any("200min exceeds 180min" in w for w in warnings)


def test_exercise_at_180_no_warning() -> None:
    log = _log(
        habit_entries=[HabitEntryCreate(habit_type=HabitType.EXERCISE, duration_minutes=180)]
    )
    assert validate_daily_log(log) == []


# --- Room temp ---


def test_room_temp_too_cold_warning() -> None:
    log = _log(habit_entries=[HabitEntryCreate(habit_type=HabitType.ROOM_TEMP_F, value="55")])
    warnings = validate_daily_log(log)
    assert any("55.0°F" in w for w in warnings)


def test_room_temp_too_hot_warning() -> None:
    log = _log(habit_entries=[HabitEntryCreate(habit_type=HabitType.ROOM_TEMP_F, value="80")])
    warnings = validate_daily_log(log)
    assert any("80.0°F" in w for w in warnings)


def test_room_temp_optimal_no_warning() -> None:
    log = _log(habit_entries=[HabitEntryCreate(habit_type=HabitType.ROOM_TEMP_F, value="67")])
    assert validate_daily_log(log) == []


def test_room_temp_non_numeric_no_warning() -> None:
    log = _log(habit_entries=[HabitEntryCreate(habit_type=HabitType.ROOM_TEMP_F, value="cool")])
    assert validate_daily_log(log) == []


# --- Alcohol ---


def test_alcohol_over_6_warning() -> None:
    log = _log(habit_entries=[HabitEntryCreate(habit_type=HabitType.ALCOHOL, value="8")])
    warnings = validate_daily_log(log)
    assert any("8.0 units" in w for w in warnings)


def test_alcohol_at_6_no_warning() -> None:
    log = _log(habit_entries=[HabitEntryCreate(habit_type=HabitType.ALCOHOL, value="6")])
    assert validate_daily_log(log) == []


# --- Red light ---


def test_red_light_over_30_warning() -> None:
    log = _log(red_light_entries=[RedLightEntryCreate(duration_minutes=45)])
    warnings = validate_daily_log(log)
    assert any("45min exceeds 30min" in w for w in warnings)


def test_red_light_at_30_no_warning() -> None:
    log = _log(red_light_entries=[RedLightEntryCreate(duration_minutes=30)])
    assert validate_daily_log(log) == []


# --- Combined ---


def test_multiple_warnings_from_different_types() -> None:
    log = _log(
        caffeine_entries=[CaffeineEntryCreate(amount_mg=500, source=CaffeineSource.OTHER)],
        nap_entries=[NapEntryCreate(duration_minutes=180)],
        habit_entries=[HabitEntryCreate(habit_type=HabitType.ALCOHOL, value="10")],
    )
    warnings = validate_daily_log(log)
    assert len(warnings) >= 3


def test_empty_log_no_warnings() -> None:
    assert validate_daily_log(DailyLogCreate()) == []
