"""Baseline schema: every table as of the start of the migration chain.

The app bootstrapped its schema with ``Base.metadata.create_all`` before any
migration existed, so the chain had no revision that could build a database
from scratch — ``001`` assumed ``user_settings`` was already there (issue
#68). This baseline captures that pre-001 schema: all current tables EXCEPT
``experiments`` (created by 002), with ``user_settings`` NOT yet carrying
``last_oura_sync`` (added by 001). Upgrading an empty database through
000→001→002 must produce a schema identical to ``create_all`` — enforced by
``backend/tests/test_migrations.py``.

Revision ID: 000_baseline
Revises:
Create Date: 2026-07-15
"""

import sqlalchemy as sa

from alembic import op

revision = "000_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "daily_logs",
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("copied_from_date", sa.Date(), nullable=True),
        sa.Column("is_sick", sa.Boolean(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("date"),
    )
    op.create_table(
        "red_light_panels",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("wavelength_nm", sa.Integer(), nullable=True),
        sa.Column("irradiance_mw_cm2", sa.Float(), nullable=True),
        sa.Column("default_distance_inches", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "sleep_records",
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("total_sleep_minutes", sa.Integer(), nullable=True),
        sa.Column("rem_minutes", sa.Integer(), nullable=True),
        sa.Column("deep_minutes", sa.Integer(), nullable=True),
        sa.Column("light_minutes", sa.Integer(), nullable=True),
        sa.Column("sleep_efficiency", sa.Float(), nullable=True),
        sa.Column("onset_latency_minutes", sa.Integer(), nullable=True),
        sa.Column("avg_hrv", sa.Float(), nullable=True),
        sa.Column("lowest_hr", sa.Integer(), nullable=True),
        sa.Column("avg_hr", sa.Float(), nullable=True),
        sa.Column("avg_breath_rate", sa.Float(), nullable=True),
        sa.Column("readiness_score", sa.Integer(), nullable=True),
        sa.Column("sleep_score", sa.Integer(), nullable=True),
        sa.Column("bedtime", sa.DateTime(), nullable=True),
        sa.Column("wake_time", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("date"),
    )
    op.create_table(
        "user_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("oura_token", sa.Text(), nullable=True),
        sa.Column("typical_bedtime", sa.Time(), nullable=True),
        sa.Column("target_wake_time", sa.Time(), nullable=True),
        sa.Column(
            "caffeine_sensitivity",
            sa.Enum("FAST", "NORMAL", "SLOW", name="caffeinesensitivity"),
            nullable=False,
        ),
        sa.Column("timezone", sa.String(length=50), nullable=False),
        sa.Column(
            "chronotype", sa.Enum("EARLY", "INTERMEDIATE", "LATE", name="chronotype"), nullable=True
        ),
        sa.Column("zip_code", sa.String(length=10), nullable=True),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column(
            "display_mode",
            sa.Enum("CIRCADIAN", "LIGHT", "AUTO", name="displaymode"),
            nullable=False,
        ),
        sa.Column("circadian_mode_start", sa.Time(), nullable=False),
        sa.Column("onboarding_completed", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "caffeine_entries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("time", sa.Time(), nullable=True),
        sa.Column("amount_mg", sa.Integer(), nullable=False),
        sa.Column(
            "source",
            sa.Enum(
                "ESPRESSO",
                "DRIP_COFFEE",
                "COLD_BREW",
                "TEA",
                "ENERGY_DRINK",
                "SODA",
                "SUPPLEMENT",
                "OTHER",
                name="caffeinesource",
            ),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["date"],
            ["daily_logs.date"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "habit_entries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column(
            "habit_type",
            sa.Enum(
                "BLUE_BLOCKERS_ON",
                "SCREENS_OFF",
                "EXERCISE",
                "ALCOHOL",
                "ROOM_TEMP_F",
                "STRESS_LEVEL",
                "SAUNA",
                "WARM_SHOWER",
                name="habittype",
            ),
            nullable=False,
        ),
        sa.Column("time", sa.Time(), nullable=True),
        sa.Column("value", sa.String(length=100), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["date"],
            ["daily_logs.date"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "meal_entries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("time", sa.Time(), nullable=True),
        sa.Column("is_last_meal", sa.Boolean(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["date"],
            ["daily_logs.date"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "nap_entries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["date"],
            ["daily_logs.date"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "nsdr_entries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("time", sa.Time(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column(
            "nsdr_type",
            sa.Enum(
                "YOGA_NIDRA",
                "BODY_SCAN",
                "SLEEP_HYPNOSIS",
                "GUIDED_RELAXATION",
                "OTHER",
                name="nsdrtype",
            ),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["date"],
            ["daily_logs.date"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "pre_bed_ritual_entries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("time", sa.Time(), nullable=True),
        sa.Column(
            "ritual_type",
            sa.Enum(
                "DEEP_BREATHING",
                "LEGS_UP_WALL",
                "STRETCHING",
                "JOURNALING",
                "READING_FICTION",
                "OTHER",
                name="prebedritualtype",
            ),
            nullable=False,
        ),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["date"],
            ["daily_logs.date"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "red_light_entries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("panel_id", sa.Integer(), nullable=True),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["date"],
            ["daily_logs.date"],
        ),
        sa.ForeignKeyConstraint(
            ["panel_id"],
            ["red_light_panels.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "sexual_activity_entries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("time", sa.Time(), nullable=True),
        sa.Column(
            "activity_type",
            sa.Enum(
                "PARTNERED", "SOLO_WITH_CONTENT", "SOLO_WITHOUT_CONTENT", name="sexualactivitytype"
            ),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["date"],
            ["daily_logs.date"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("date", name="uq_sexual_activity_date"),
    )
    op.create_table(
        "stimulating_activity_entries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column(
            "activity_type",
            sa.Enum(
                "TV_MOVIES",
                "VIDEO_GAMES",
                "GRIPPING_AUDIOBOOK",
                "OTHER",
                name="stimulatingactivitytype",
            ),
            nullable=False,
        ),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["date"],
            ["daily_logs.date"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "sunlight_entries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("estimated_lux", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["date"],
            ["daily_logs.date"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "supplement_entries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("time", sa.Time(), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("dose_mg", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(
            ["date"],
            ["daily_logs.date"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("caffeine_entries")
    op.drop_table("habit_entries")
    op.drop_table("meal_entries")
    op.drop_table("nap_entries")
    op.drop_table("nsdr_entries")
    op.drop_table("pre_bed_ritual_entries")
    op.drop_table("red_light_entries")
    op.drop_table("sexual_activity_entries")
    op.drop_table("stimulating_activity_entries")
    op.drop_table("sunlight_entries")
    op.drop_table("supplement_entries")
    op.drop_table("red_light_panels")
    op.drop_table("daily_logs")
    op.drop_table("sleep_records")
    op.drop_table("user_settings")
