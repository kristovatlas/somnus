"""Pydantic schemas for API request/response validation."""

from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, Field

from backend.models import (
    CaffeineSensitivity,
    CaffeineSource,
    Chronotype,
    DisplayMode,
    HabitType,
    NSDRType,
    PreBedRitualType,
    SexualActivityType,
    StimulatingActivityType,
)

# --- Health Check ---


class HealthResponse(BaseModel):
    status: str
    version: str


# --- Sleep Record (from Oura) ---


class SleepRecordOut(BaseModel):
    date: dt.date
    total_sleep_minutes: int | None = None
    rem_minutes: int | None = None
    deep_minutes: int | None = None
    light_minutes: int | None = None
    rem_pct: float | None = None
    deep_pct: float | None = None
    light_pct: float | None = None
    sleep_efficiency: float | None = None
    onset_latency_minutes: int | None = None
    avg_hrv: float | None = None
    lowest_hr: int | None = None
    avg_hr: float | None = None
    avg_breath_rate: float | None = None
    readiness_score: int | None = None
    sleep_score: int | None = None
    bedtime: dt.datetime | None = None
    wake_time: dt.datetime | None = None

    model_config = {"from_attributes": True}


# --- Caffeine ---


class CaffeineEntryCreate(BaseModel):
    time: dt.time | None = None
    amount_mg: int = Field(ge=1, le=600)
    source: CaffeineSource = CaffeineSource.OTHER


class CaffeineEntryOut(BaseModel):
    id: int
    date: dt.date
    time: dt.time | None = None
    amount_mg: int
    source: CaffeineSource

    model_config = {"from_attributes": True}


# --- Meal ---


class MealEntryCreate(BaseModel):
    time: dt.time | None = None
    is_last_meal: bool | None = None
    notes: str | None = None


class MealEntryOut(BaseModel):
    id: int
    date: dt.date
    time: dt.time | None = None
    is_last_meal: bool | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


# --- Supplement ---


class SupplementEntryCreate(BaseModel):
    time: dt.time | None = None
    name: str = Field(max_length=100)
    dose_mg: float | None = None


class SupplementEntryOut(BaseModel):
    id: int
    date: dt.date
    time: dt.time | None = None
    name: str
    dose_mg: float | None = None

    model_config = {"from_attributes": True}


# --- Habit ---


class HabitEntryCreate(BaseModel):
    habit_type: HabitType
    time: dt.time | None = None
    value: str | None = Field(default=None, max_length=100)
    duration_minutes: int | None = Field(default=None, ge=1, le=300)
    notes: str | None = None


class HabitEntryOut(BaseModel):
    id: int
    date: dt.date
    habit_type: HabitType
    time: dt.time | None = None
    value: str | None = None
    duration_minutes: int | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


# --- Stimulating Activity ---


class StimulatingActivityCreate(BaseModel):
    end_time: dt.time | None = None
    activity_type: StimulatingActivityType
    duration_minutes: int | None = Field(default=None, ge=1)


class StimulatingActivityOut(BaseModel):
    id: int
    date: dt.date
    end_time: dt.time | None = None
    activity_type: StimulatingActivityType
    duration_minutes: int | None = None

    model_config = {"from_attributes": True}


# --- Sexual Activity ---


class SexualActivityCreate(BaseModel):
    time: dt.time | None = None
    activity_type: SexualActivityType


class SexualActivityOut(BaseModel):
    id: int
    date: dt.date
    time: dt.time | None = None
    activity_type: SexualActivityType

    model_config = {"from_attributes": True}


# --- Pre-Bed Ritual ---


class PreBedRitualCreate(BaseModel):
    time: dt.time | None = None
    ritual_type: PreBedRitualType
    duration_minutes: int | None = Field(default=None, ge=1)


class PreBedRitualOut(BaseModel):
    id: int
    date: dt.date
    time: dt.time | None = None
    ritual_type: PreBedRitualType
    duration_minutes: int | None = None

    model_config = {"from_attributes": True}


# --- Nap ---


class NapEntryCreate(BaseModel):
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=240)


class NapEntryOut(BaseModel):
    id: int
    date: dt.date
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    duration_minutes: int | None = None

    model_config = {"from_attributes": True}


# --- Sunlight ---


class SunlightEntryCreate(BaseModel):
    start_time: dt.time | None = None
    duration_minutes: int | None = Field(default=None, ge=1)
    estimated_lux: int | None = None
    notes: str | None = None


class SunlightEntryOut(BaseModel):
    id: int
    date: dt.date
    start_time: dt.time | None = None
    duration_minutes: int | None = None
    estimated_lux: int | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


# --- Red Light Panel ---


class RedLightPanelCreate(BaseModel):
    name: str = Field(max_length=100)
    wavelength_nm: int | None = Field(default=None, ge=600, le=900)
    irradiance_mw_cm2: float | None = Field(default=None, ge=0)
    default_distance_inches: float | None = Field(default=None, ge=0)
    notes: str | None = None


class RedLightPanelOut(BaseModel):
    id: int
    name: str
    wavelength_nm: int | None = None
    irradiance_mw_cm2: float | None = None
    default_distance_inches: float | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


# --- Red Light Entry ---


class RedLightEntryCreate(BaseModel):
    panel_id: int | None = None
    start_time: dt.time | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=60)


class RedLightEntryOut(BaseModel):
    id: int
    date: dt.date
    panel_id: int | None = None
    start_time: dt.time | None = None
    duration_minutes: int | None = None
    dose_joules_cm2: float | None = None

    model_config = {"from_attributes": True}


# --- NSDR ---


class NSDREntryCreate(BaseModel):
    time: dt.time | None = None
    duration_minutes: int | None = Field(default=None, ge=1)
    nsdr_type: NSDRType = NSDRType.OTHER


class NSDREntryOut(BaseModel):
    id: int
    date: dt.date
    time: dt.time | None = None
    duration_minutes: int | None = None
    nsdr_type: NSDRType

    model_config = {"from_attributes": True}


# --- Daily Log (composite) ---


class DailyLogCreate(BaseModel):
    is_sick: bool | None = None
    notes: str | None = None
    caffeine_entries: list[CaffeineEntryCreate] = []
    meal_entries: list[MealEntryCreate] = []
    supplement_entries: list[SupplementEntryCreate] = []
    habit_entries: list[HabitEntryCreate] = []
    stimulating_activity_entries: list[StimulatingActivityCreate] = []
    sexual_activity_entry: SexualActivityCreate | None = None
    pre_bed_ritual_entries: list[PreBedRitualCreate] = []
    nap_entries: list[NapEntryCreate] = []
    sunlight_entries: list[SunlightEntryCreate] = []
    red_light_entries: list[RedLightEntryCreate] = []
    nsdr_entries: list[NSDREntryCreate] = []


class DailyLogOut(BaseModel):
    date: dt.date
    copied_from_date: dt.date | None = None
    is_sick: bool | None = None
    notes: str | None = None
    caffeine_entries: list[CaffeineEntryOut] = []
    meal_entries: list[MealEntryOut] = []
    supplement_entries: list[SupplementEntryOut] = []
    habit_entries: list[HabitEntryOut] = []
    stimulating_activity_entries: list[StimulatingActivityOut] = []
    sexual_activity_entry: SexualActivityOut | None = None
    pre_bed_ritual_entries: list[PreBedRitualOut] = []
    nap_entries: list[NapEntryOut] = []
    sunlight_entries: list[SunlightEntryOut] = []
    red_light_entries: list[RedLightEntryOut] = []
    nsdr_entries: list[NSDREntryOut] = []

    model_config = {"from_attributes": True}


# --- User Settings ---


# --- Daily Log Response Wrappers ---


class DailyLogResponse(BaseModel):
    """Wraps DailyLogOut with soft validation warnings."""

    data: DailyLogOut
    warnings: list[str] = []


class DailyLogSummary(BaseModel):
    """Lightweight schema for list endpoints — no nested entries."""

    date: dt.date
    copied_from_date: dt.date | None = None
    is_sick: bool | None = None
    has_entries: bool = False

    model_config = {"from_attributes": True}


# --- Export ---


class ExportData(BaseModel):
    """JSON export structure."""

    daily_logs: list[DailyLogOut] = []
    sleep_records: list[SleepRecordOut] = []


# --- User Settings ---


class UserSettingsUpdate(BaseModel):
    oura_token: str | None = None
    typical_bedtime: dt.time | None = None
    target_wake_time: dt.time | None = None
    caffeine_sensitivity: CaffeineSensitivity | None = None
    timezone: str | None = None
    chronotype: Chronotype | None = None
    zip_code: str | None = Field(default=None, max_length=10)
    age: int | None = Field(default=None, ge=1, le=120)
    display_mode: DisplayMode | None = None
    circadian_mode_start: dt.time | None = None
    onboarding_completed: bool | None = None


class UserSettingsOut(BaseModel):
    oura_token_set: bool = False
    typical_bedtime: dt.time | None = None
    target_wake_time: dt.time | None = None
    caffeine_sensitivity: CaffeineSensitivity
    timezone: str
    chronotype: Chronotype | None = None
    zip_code: str | None = None
    age: int | None = None
    display_mode: DisplayMode
    circadian_mode_start: dt.time
    onboarding_completed: bool
    last_oura_sync: dt.datetime | None = None

    model_config = {"from_attributes": True}


# --- Oura Sync ---


class OuraSyncResponse(BaseModel):
    synced_count: int
    start_date: dt.date
    end_date: dt.date
    errors: list[str] = []
