"""Tests for database initialization and model creation."""

from datetime import date, time

from sqlalchemy.orm import Session

from backend.models import (
    CaffeineEntry,
    CaffeineSource,
    DailyLog,
    HabitEntry,
    HabitType,
    NapEntry,
    NSDREntry,
    NSDRType,
    PreBedRitualEntry,
    PreBedRitualType,
    RedLightPanel,
    SexualActivityEntry,
    SexualActivityType,
    SleepRecord,
    StimulatingActivityEntry,
    StimulatingActivityType,
    SunlightEntry,
    SupplementEntry,
    UserSettings,
)


def test_tables_created(db: Session) -> None:
    """All model tables should exist after DB init."""
    from backend.database import Base

    table_names = set(Base.metadata.tables.keys())
    expected = {
        "sleep_records",
        "daily_logs",
        "caffeine_entries",
        "meal_entries",
        "supplement_entries",
        "habit_entries",
        "stimulating_activity_entries",
        "sexual_activity_entries",
        "pre_bed_ritual_entries",
        "nap_entries",
        "sunlight_entries",
        "red_light_panels",
        "red_light_entries",
        "nsdr_entries",
        "user_settings",
    }
    assert expected.issubset(table_names)


def test_create_daily_log_with_caffeine(db: Session) -> None:
    """Can create a daily log with caffeine entries."""
    log = DailyLog(date=date(2025, 1, 15))
    db.add(log)
    db.flush()

    entry = CaffeineEntry(
        date=date(2025, 1, 15),
        time=time(8, 30),
        amount_mg=95,
        source=CaffeineSource.DRIP_COFFEE,
    )
    db.add(entry)
    db.commit()

    result = db.get(DailyLog, date(2025, 1, 15))
    assert result is not None
    assert len(result.caffeine_entries) == 1
    assert result.caffeine_entries[0].amount_mg == 95
    assert result.caffeine_entries[0].source == CaffeineSource.DRIP_COFFEE


def test_daily_log_nullable_fields(db: Session) -> None:
    """All entry fields except date should be nullable (missing != negative)."""
    log = DailyLog(date=date(2025, 2, 1))
    db.add(log)
    db.commit()

    result = db.get(DailyLog, date(2025, 2, 1))
    assert result is not None
    assert result.is_sick is None
    assert result.notes is None
    assert result.copied_from_date is None


def test_daily_log_sick_flag(db: Session) -> None:
    """Sick day toggle works."""
    log = DailyLog(date=date(2025, 3, 1), is_sick=True)
    db.add(log)
    db.commit()

    result = db.get(DailyLog, date(2025, 3, 1))
    assert result is not None
    assert result.is_sick is True


def test_sleep_record_stage_percentages(db: Session) -> None:
    """Computed stage percentage properties work correctly."""
    record = SleepRecord(
        date=date(2025, 1, 15),
        total_sleep_minutes=480,
        rem_minutes=120,
        deep_minutes=90,
        light_minutes=270,
    )
    db.add(record)
    db.commit()

    result = db.get(SleepRecord, date(2025, 1, 15))
    assert result is not None
    assert result.rem_pct == 25.0
    assert result.deep_pct == 18.8
    assert result.light_pct == 56.2


def test_sleep_record_null_stages(db: Session) -> None:
    """Stage percentages return None when data is missing."""
    record = SleepRecord(date=date(2025, 1, 16))
    db.add(record)
    db.commit()

    result = db.get(SleepRecord, date(2025, 1, 16))
    assert result is not None
    assert result.rem_pct is None
    assert result.deep_pct is None
    assert result.light_pct is None


def test_create_all_entry_types(db: Session) -> None:
    """Can create one of each entry type under a daily log."""
    log = DailyLog(date=date(2025, 4, 1))
    db.add(log)
    db.flush()

    d = date(2025, 4, 1)

    db.add(SupplementEntry(date=d, name="magnesium_threonate", dose_mg=144))
    db.add(HabitEntry(date=d, habit_type=HabitType.EXERCISE, value="moderate", duration_minutes=45))
    db.add(
        StimulatingActivityEntry(
            date=d,
            end_time=time(21, 30),
            activity_type=StimulatingActivityType.VIDEO_GAMES,
        )
    )
    db.add(
        SexualActivityEntry(
            date=d,
            activity_type=SexualActivityType.PARTNERED,
        )
    )
    db.add(
        PreBedRitualEntry(
            date=d,
            ritual_type=PreBedRitualType.DEEP_BREATHING,
            duration_minutes=10,
        )
    )
    db.add(NapEntry(date=d, start_time=time(13, 0), duration_minutes=20))
    db.add(SunlightEntry(date=d, start_time=time(7, 15), duration_minutes=20, estimated_lux=30000))
    db.add(NSDREntry(date=d, duration_minutes=15, nsdr_type=NSDRType.YOGA_NIDRA))

    db.commit()

    result = db.get(DailyLog, d)
    assert result is not None
    assert len(result.supplement_entries) == 1
    assert len(result.habit_entries) == 1
    assert len(result.stimulating_activity_entries) == 1
    assert result.sexual_activity_entry is not None
    assert len(result.pre_bed_ritual_entries) == 1
    assert len(result.nap_entries) == 1
    assert len(result.sunlight_entries) == 1
    assert len(result.nsdr_entries) == 1


def test_red_light_panel_and_entry(db: Session) -> None:
    """Red light panel presets and dose calculation work."""
    panel = RedLightPanel(
        name="Joovv Go",
        wavelength_nm=660,
        irradiance_mw_cm2=86.0,
        default_distance_inches=6.0,
    )
    db.add(panel)
    db.flush()

    log = DailyLog(date=date(2025, 4, 2))
    db.add(log)
    db.flush()

    from backend.models import RedLightEntry

    entry = RedLightEntry(
        date=date(2025, 4, 2),
        panel_id=panel.id,
        start_time=time(20, 0),
        duration_minutes=15,
    )
    db.add(entry)
    db.commit()

    db.refresh(entry)
    # dose = 86.0 mW/cm2 x 15 min x 60 sec / 1000 = 77.4 J/cm2
    assert entry.dose_joules_cm2 == 77.4


def test_user_settings_defaults(db: Session) -> None:
    """User settings have sensible defaults."""
    settings = UserSettings(id=1)
    db.add(settings)
    db.commit()

    result = db.get(UserSettings, 1)
    assert result is not None
    assert result.caffeine_sensitivity.value == "normal"
    assert result.timezone == "America/New_York"
    assert result.display_mode.value == "circadian"
    assert result.circadian_mode_start == time(20, 0)
    assert result.onboarding_completed is False
    assert result.oura_token is None
    assert result.chronotype is None
