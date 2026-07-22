"""Age-adjusted sleep stage targets and consistency threshold ratings.

Data from PLAN.md Section 7 (stage targets) and Section 12 (consistency).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class StageTargets:
    """Age-adjusted target ranges for deep and REM sleep."""

    age_group: str
    deep_min_minutes: int
    deep_max_minutes: int
    rem_min_minutes: int
    rem_max_minutes: int


_AGE_BRACKETS: list[tuple[int, int, StageTargets]] = [
    (18, 30, StageTargets("18-30", 75, 100, 90, 120)),
    (31, 50, StageTargets("31-50", 60, 90, 90, 120)),
    (51, 65, StageTargets("51-65", 45, 75, 80, 110)),
    (66, 999, StageTargets("66+", 30, 60, 70, 100)),
]


def get_stage_targets(age: int | None) -> StageTargets | None:
    """Return age-adjusted stage targets, or None if age not set."""
    if age is None:
        return None
    for low, high, targets in _AGE_BRACKETS:
        if low <= age <= high:
            return targets
    return None


def rate_sigma(minutes: float) -> str:
    """Rate bedtime standard deviation (σ)."""
    if minutes < 30:
        return "consistent"
    if minutes <= 60:
        return "somewhat_inconsistent"
    return "erratic"


def rate_delta(minutes: float) -> str:
    """Rate mean offset from typical bedtime (δ)."""
    if minutes < 30:
        return "on_target"
    if minutes <= 60:
        return "drifting"
    return "misaligned"


def rate_drift(minutes: float) -> str:
    """Rate weekday/weekend bedtime drift (Δ)."""
    if minutes < 30:
        return "minimal"
    if minutes <= 60:
        return "moderate"
    return "significant"


def rate_stage_vs_target(avg: float, min_target: int, max_target: int) -> str:
    """Rate a sleep stage average against its target range."""
    if avg < min_target:
        return "below"
    if avg > max_target:
        return "above"
    return "in_range"


# --- Science Thresholds for Recommendations Engine ---


@dataclass(frozen=True, slots=True)
class ScienceThreshold:
    """Evidence-based threshold for a tracked factor.

    Used by the recommendation engine to compare the user's recent averages
    against known thresholds from sleep science literature.
    """

    column: str  # DataFrame column name
    label: str
    direction: str  # "above" or "below"
    threshold_value: float
    comparison: str  # "gt", "lt", "outside_range"
    evidence_level: str  # very_high / high / moderate / low
    title: str
    body_template: str  # {avg}, {threshold}, {n_days} placeholders
    range_upper: float | None = None  # for outside_range comparisons
    experiment_template: str | None = None
    untried_title: str | None = None
    untried_suggestion: str | None = None


SCIENCE_THRESHOLDS: list[ScienceThreshold] = [
    ScienceThreshold(
        column="last_caffeine_hour",
        label="Last Caffeine Time",
        direction="above",
        threshold_value=14.0,
        comparison="gt",
        evidence_level="very_high",
        title="Consider an earlier caffeine cutoff",
        body_template=(
            "Your average last caffeine intake is around {avg:.0f}:00, "
            "which is after the commonly recommended 2 PM cutoff. "
            "Based on {n_days} days of your data, an earlier cutoff "
            "may be associated with better sleep."
        ),
        experiment_template="Try cutting off caffeine before 2 PM for 2 weeks",
    ),
    ScienceThreshold(
        column="total_caffeine_mg",
        label="Total Caffeine",
        direction="above",
        threshold_value=400.0,
        comparison="gt",
        evidence_level="very_high",
        title="Consider reducing total caffeine intake",
        body_template=(
            "Your average daily caffeine is {avg:.0f} mg, above the "
            "400 mg threshold often cited in research. "
            "Based on {n_days} days, reducing intake may be associated "
            "with sleep improvements."
        ),
        experiment_template="Try limiting caffeine to under 400 mg/day for 2 weeks",
    ),
    ScienceThreshold(
        column="room_temp_f",
        label="Room Temperature",
        direction="above",
        threshold_value=68.0,
        comparison="outside_range",
        range_upper=68.0,
        evidence_level="very_high",
        title="Consider adjusting your room temperature",
        body_template=(
            "Your average room temperature is {avg:.1f}°F, outside the "
            "65–68°F range often associated with optimal sleep. "
            "Based on {n_days} days of data."
        ),
        experiment_template="Try setting your thermostat to 65–68°F for 2 weeks",
    ),
    ScienceThreshold(
        column="alcohol",
        label="Alcohol",
        direction="above",
        threshold_value=0.5,
        comparison="gt",
        evidence_level="very_high",
        title="Alcohol use may be affecting your sleep",
        body_template=(
            "You had alcohol on {avg:.0%} of the last {n_days} days. "
            "Research consistently associates alcohol with reduced sleep quality, "
            "even in moderate amounts."
        ),
        experiment_template="Try eliminating alcohol for 2 weeks and compare",
    ),
    ScienceThreshold(
        column="sunlight_morning_minutes",
        label="Morning Sunlight",
        direction="below",
        threshold_value=15.0,
        comparison="lt",
        evidence_level="very_high",
        title="Consider more morning sunlight exposure",
        body_template=(
            "Your average morning sunlight is {avg:.0f} minutes, "
            "below the 15-minute threshold associated with circadian "
            "rhythm regulation. Based on {n_days} days."
        ),
        experiment_template="Try getting 15+ minutes of morning sunlight for 2 weeks",
        untried_title="Try tracking morning sunlight",
        untried_suggestion=(
            "Morning sunlight exposure is one of the strongest "
            "circadian rhythm regulators. Try logging it to see how "
            "it relates to your sleep."
        ),
    ),
    ScienceThreshold(
        column="blue_blockers",
        label="Blue Blockers",
        direction="below",
        threshold_value=0.5,
        comparison="lt",
        evidence_level="very_high",
        title="Consider using blue-blocking glasses in the evening",
        body_template=(
            "You used blue blockers on only {avg:.0%} of the last {n_days} "
            "days. Evening blue light exposure is associated with delayed "
            "melatonin onset."
        ),
        experiment_template="Try wearing blue blockers after sunset for 2 weeks",
        untried_title="Try blue-blocking glasses",
        untried_suggestion=(
            "Blue light in the evening can delay melatonin release. "
            "Try tracking blue blocker usage to see if it makes a difference."
        ),
    ),
    ScienceThreshold(
        column="screens_off",
        label="Screens Off",
        direction="below",
        threshold_value=0.5,
        comparison="lt",
        evidence_level="very_high",
        title="Consider a screens-off routine before bed",
        body_template=(
            "You turned off screens on only {avg:.0%} of the last {n_days} "
            "days. Screen use close to bedtime is associated with "
            "longer onset latency."
        ),
        experiment_template="Try a screens-off period 1 hour before bed for 2 weeks",
        untried_title="Try a screens-off routine",
        untried_suggestion=(
            "Screen light before bed can interfere with melatonin. "
            "Try logging a screens-off habit to track its impact."
        ),
    ),
    ScienceThreshold(
        column="last_meal_hour",
        label="Last Meal Time",
        direction="above",
        threshold_value=20.0,
        comparison="gt",
        evidence_level="moderate",
        title="Consider eating your last meal earlier",
        body_template=(
            "Your average last meal is around {avg:.0f}:00, which may be "
            "close to bedtime. Research suggests finishing eating 2–3 hours "
            "before bed. Based on {n_days} days."
        ),
        experiment_template="Try finishing your last meal by 7 PM for 2 weeks",
    ),
    ScienceThreshold(
        column="nap_total_minutes",
        label="Nap Duration",
        direction="above",
        threshold_value=30.0,
        comparison="gt",
        evidence_level="high",
        title="Consider shorter naps",
        body_template=(
            "Your average nap duration is {avg:.0f} minutes, above the "
            "30-minute threshold. Longer naps may be associated with "
            "nighttime sleep disruption. Based on {n_days} days."
        ),
        experiment_template="Try limiting naps to 20–30 minutes for 2 weeks",
    ),
    ScienceThreshold(
        column="exercise_done",
        label="Exercise",
        direction="below",
        threshold_value=0.3,
        comparison="lt",
        evidence_level="high",
        title="Consider adding regular exercise",
        body_template=(
            "You exercised on only {avg:.0%} of the last {n_days} days. "
            "Regular exercise is associated with improved sleep quality "
            "in many studies."
        ),
        experiment_template="Try exercising at least 4 days per week for 2 weeks",
        untried_title="Try tracking exercise",
        untried_suggestion=(
            "Exercise is strongly associated with sleep quality. "
            "Try logging your exercise to see how it relates."
        ),
    ),
    # Untried-only suggestions
    ScienceThreshold(
        column="red_light_done",
        label="Red Light Therapy",
        direction="below",
        threshold_value=0.3,
        comparison="lt",
        evidence_level="moderate",
        title="Consider red light therapy",
        body_template=(
            "You used red light therapy on only {avg:.0%} of the last "
            "{n_days} days. Some research suggests it may support "
            "melatonin production."
        ),
        experiment_template="Try red light therapy sessions for 2 weeks",
        untried_title="Try red light therapy",
        untried_suggestion=(
            "Red/near-infrared light therapy may support melatonin "
            "production. Try logging sessions to see if it helps."
        ),
    ),
    ScienceThreshold(
        column="nsdr_done",
        label="NSDR",
        direction="below",
        threshold_value=0.3,
        comparison="lt",
        evidence_level="moderate",
        title="Consider NSDR or yoga nidra",
        body_template=(
            "You practiced NSDR on only {avg:.0%} of the last {n_days} "
            "days. NSDR protocols may help with relaxation and "
            "sleep onset."
        ),
        experiment_template="Try a daily NSDR session for 2 weeks",
        untried_title="Try NSDR (non-sleep deep rest)",
        untried_suggestion=(
            "NSDR protocols like yoga nidra may help with relaxation. "
            "Try logging sessions to track any effect."
        ),
    ),
    ScienceThreshold(
        column="ritual_done",
        label="Pre-Bed Ritual",
        direction="below",
        threshold_value=0.3,
        comparison="lt",
        evidence_level="moderate",
        title="Consider a consistent pre-bed ritual",
        body_template=(
            "You practiced a pre-bed ritual on only {avg:.0%} of the "
            "last {n_days} days. Consistent wind-down routines are "
            "associated with better sleep onset."
        ),
        experiment_template="Try a nightly pre-bed ritual for 2 weeks",
        untried_title="Try a pre-bed ritual",
        untried_suggestion=(
            "A consistent wind-down routine may help signal your body "
            "to prepare for sleep. Try logging one."
        ),
    ),
    ScienceThreshold(
        column="warm_shower",
        label="Warm Shower",
        direction="below",
        threshold_value=0.3,
        comparison="lt",
        evidence_level="high",
        title="Consider a warm shower before bed",
        body_template=(
            "You took a warm shower on only {avg:.0%} of the last "
            "{n_days} days. Research suggests warm showers 1–2 hours "
            "before bed can aid the natural temperature drop for sleep."
        ),
        experiment_template="Try a warm shower 1–2 hours before bed for 2 weeks",
        untried_title="Try a warm shower before bed",
        untried_suggestion=(
            "A warm shower before bed may aid the body's natural "
            "temperature drop. Try logging it to see."
        ),
    ),
]


# --- Predictor Action Text for Data-Driven Recommendations ---


PREDICTOR_ACTIONS: dict[str, dict[str, str]] = {
    "total_caffeine_mg": {
        "negative": "Reducing total caffeine may be associated with better {outcome}",
        "positive": "Your data suggests higher caffeine is associated with better {outcome}",
    },
    "last_caffeine_hour": {
        "negative": "An earlier caffeine cutoff may be associated with better {outcome}",
        "positive": "A later caffeine cutoff appears associated with better {outcome} in your data",
    },
    "last_meal_hour": {
        "negative": "Eating your last meal earlier may be associated with better {outcome}",
        "positive": "Your data shows a later last meal associated with better {outcome}",
    },
    "exercise_done": {
        "positive": "Exercise appears associated with better {outcome} in your data",
        "negative": "Your data suggests exercise days are associated with lower {outcome}",
    },
    "exercise_duration_minutes": {
        "positive": "Longer exercise sessions appear associated with better {outcome}",
        "negative": "Your data suggests longer exercise may be associated with lower {outcome}",
    },
    "alcohol": {
        "negative": "Alcohol use appears associated with lower {outcome} in your data",
        "positive": (
            "Your data shows an unexpected positive association between alcohol and {outcome}"
        ),
    },
    "stress_level": {
        "negative": "Higher stress appears associated with lower {outcome}",
        "positive": "Lower stress appears associated with better {outcome}",
    },
    "room_temp_f": {
        "negative": "Higher room temperature appears associated with lower {outcome}",
        "positive": "Higher room temperature appears associated with better {outcome}",
    },
    "blue_blockers": {
        "positive": "Blue blocker use appears associated with better {outcome}",
        "negative": (
            "Your data shows an unexpected negative association for blue blockers and {outcome}"
        ),
    },
    "screens_off": {
        "positive": "Turning off screens appears associated with better {outcome}",
        "negative": "Your data shows an unexpected pattern with screens-off and {outcome}",
    },
    "sauna": {
        "positive": "Sauna use appears associated with better {outcome}",
        "negative": "Sauna use appears associated with lower {outcome} in your data",
    },
    "warm_shower": {
        "positive": "Warm showers appear associated with better {outcome}",
        "negative": "Your data suggests warm showers are associated with lower {outcome}",
    },
    "stimulating_minutes": {
        "negative": "More stimulating activity appears associated with lower {outcome}",
        "positive": "Your data shows more stimulating activity associated with better {outcome}",
    },
    "stimulating_last_hour": {
        "negative": "Later stimulating activity appears associated with lower {outcome}",
        "positive": "Your data shows later stimulating activity associated with better {outcome}",
    },
    "nap_total_minutes": {
        "negative": "Longer naps appear associated with lower nighttime {outcome}",
        "positive": "Napping appears associated with better {outcome} in your data",
    },
    "nap_count": {
        "negative": "More naps appear associated with lower nighttime {outcome}",
        "positive": "Napping appears associated with better {outcome} in your data",
    },
    "sunlight_morning_minutes": {
        "positive": "More morning sunlight appears associated with better {outcome}",
        "negative": "Your data shows an unexpected pattern with morning sunlight and {outcome}",
    },
    "sunlight_first_hour": {
        "negative": "Earlier sunlight exposure appears associated with better {outcome}",
        "positive": "Your data shows later sunlight associated with better {outcome}",
    },
    "red_light_done": {
        "positive": "Red light therapy appears associated with better {outcome}",
        "negative": "Your data shows an unexpected pattern with red light and {outcome}",
    },
    "red_light_dose_j_cm2": {
        "positive": "Higher red light dose appears associated with better {outcome}",
        "negative": "Your data shows higher red light dose associated with lower {outcome}",
    },
    "nsdr_done": {
        "positive": "NSDR practice appears associated with better {outcome}",
        "negative": "Your data shows an unexpected pattern with NSDR and {outcome}",
    },
    "nsdr_total_minutes": {
        "positive": "More NSDR time appears associated with better {outcome}",
        "negative": "Your data shows more NSDR time associated with lower {outcome}",
    },
    "ritual_done": {
        "positive": "Pre-bed rituals appear associated with better {outcome}",
        "negative": "Your data shows an unexpected pattern with pre-bed rituals and {outcome}",
    },
    "ritual_total_minutes": {
        "positive": "Longer rituals appear associated with better {outcome}",
        "negative": "Your data shows longer rituals associated with lower {outcome}",
    },
    "sexual_activity": {
        "positive": "Sexual activity appears associated with better {outcome}",
        "negative": "Your data shows sexual activity associated with lower {outcome}",
    },
    "sigma_7d": {
        "negative": "More consistent bedtimes appear associated with better {outcome}",
        "positive": "Your data shows an unexpected pattern with bedtime variability and {outcome}",
    },
    "delta_7d": {
        "negative": "A smaller bedtime offset appears associated with better {outcome}",
        "positive": "Your data shows an unexpected pattern with bedtime offset and {outcome}",
    },
    "bedtime_hour": {
        "negative": "An earlier bedtime appears associated with better {outcome}",
        "positive": "A later bedtime appears associated with better {outcome} in your data",
    },
}
