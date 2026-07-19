"""Tests for database initialization and model creation."""

import os
import stat
from datetime import date, time
from pathlib import Path

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend import database
from backend.database import _harden_db_permissions
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


class TestForeignKeyEnforcement:
    """T-09 (docs/THREAT_MODEL.md): PRAGMA foreign_keys=ON must reject
    orphaned child rows instead of silently accepting them."""

    def test_orphan_child_row_rejected(self, db: Session) -> None:
        # caffeine_entries.date -> daily_logs.date; no parent log exists
        db.add(
            CaffeineEntry(
                date=date(2099, 1, 1),
                time=time(8, 0),
                amount_mg=50,
                source=CaffeineSource.DRIP_COFFEE,
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

    def test_child_row_with_parent_accepted(self, db: Session) -> None:
        db.add(DailyLog(date=date(2099, 2, 1)))
        db.flush()
        db.add(
            CaffeineEntry(
                date=date(2099, 2, 1),
                time=time(8, 0),
                amount_mg=50,
                source=CaffeineSource.DRIP_COFFEE,
            )
        )
        db.commit()  # no raise
        assert db.get(DailyLog, date(2099, 2, 1)) is not None


class TestDBPermissions:
    """T-08 (docs/THREAT_MODEL.md): DB file owner-only; only the app-managed
    default directory is dir-hardened."""

    def _make_db(self, parent: Path) -> Path:
        db_file = parent / "somnus.db"
        db_file.write_bytes(b"data")
        # Start world-readable so the assertion proves hardening *tightens* it.
        os.chmod(parent, 0o755)  # noqa: S103
        os.chmod(db_file, 0o644)
        return db_file

    def test_harden_default_dir_sets_owner_only_bits(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        somnus_dir = tmp_path / ".somnus"
        somnus_dir.mkdir()
        monkeypatch.setattr(database, "DEFAULT_DB_DIR", somnus_dir)
        db_file = self._make_db(somnus_dir)

        _harden_db_permissions(db_file)

        assert stat.S_IMODE(os.stat(somnus_dir).st_mode) == 0o700
        assert stat.S_IMODE(os.stat(db_file).st_mode) == 0o600

    def test_harden_custom_path_leaves_parent_untouched(self, tmp_path: Path) -> None:
        # A user-supplied SOMNUS_DB_PATH may live in a shared directory (the
        # T-07 encrypted-volume flow) — Somnus must not lock that to 0700,
        # but the DB file itself must still be hardened.
        shared_dir = tmp_path / "shared-project"
        shared_dir.mkdir()
        db_file = self._make_db(shared_dir)

        _harden_db_permissions(db_file)

        assert stat.S_IMODE(os.stat(shared_dir).st_mode) == 0o755
        assert stat.S_IMODE(os.stat(db_file).st_mode) == 0o600

    def test_harden_file_even_when_dir_chmod_fails(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # The file chmod must not be skipped by a failing directory chmod
        # (previously one try block covered both).
        somnus_dir = tmp_path / ".somnus"
        somnus_dir.mkdir()
        monkeypatch.setattr(database, "DEFAULT_DB_DIR", somnus_dir)
        db_file = self._make_db(somnus_dir)

        real_chmod = os.chmod

        def chmod_failing_on_dir(path: object, mode: int) -> None:
            if Path(str(path)) == somnus_dir:
                raise OSError("operation not permitted")
            real_chmod(path, mode)  # type: ignore[arg-type]

        monkeypatch.setattr(os, "chmod", chmod_failing_on_dir)

        _harden_db_permissions(db_file)

        assert stat.S_IMODE(os.stat(db_file).st_mode) == 0o600

    def test_harden_memory_path_is_noop(self) -> None:
        # Must not raise on the in-memory sentinel used in tests
        _harden_db_permissions(Path(":memory:"))


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
