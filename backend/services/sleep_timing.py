"""Sleep timing analysis — chronotype inference, optimal bedtime, social jet lag."""

from __future__ import annotations

from typing import Any

import pandas as pd

from backend.science.reference_data import rate_drift


def compute_sleep_timing(df: pd.DataFrame, min_days: int = 30) -> dict[str, Any]:
    """Analyze sleep timing patterns from the analysis DataFrame.

    Requires bedtime/wake data for at least min_days.
    """
    if df.empty:
        return _empty_result()

    # Need sleep_midpoint_hour for chronotype
    if "sleep_midpoint_hour" not in df.columns:
        return _empty_result()

    midpoints = df["sleep_midpoint_hour"].dropna()
    n_days = len(midpoints)

    if n_days < min_days:
        return _empty_result(n_days=n_days)

    avg_midpoint = float(midpoints.mean())

    # Chronotype classification based on free-day sleep midpoint
    chronotype, confidence = _classify_chronotype(avg_midpoint, n_days)

    # Social jet lag: difference between weekend and weekday midpoints
    social_jet_lag_minutes: float | None = None
    social_jet_lag_rating: str | None = None

    if "is_weekend" in df.columns:
        weekday_mid = df.loc[df["is_weekend"] == False, "sleep_midpoint_hour"].dropna()  # noqa: E712
        weekend_mid = df.loc[df["is_weekend"] == True, "sleep_midpoint_hour"].dropna()  # noqa: E712

        if len(weekday_mid) >= 5 and len(weekend_mid) >= 3:
            social_jet_lag_minutes = round(
                abs(float(weekend_mid.mean()) - float(weekday_mid.mean())) * 60, 1
            )
            social_jet_lag_rating = rate_drift(social_jet_lag_minutes)

    # Optimal bedtime window: based on best sleep scores
    optimal_start, optimal_end = _compute_optimal_bedtime(df)

    return {
        "chronotype": chronotype,
        "chronotype_confidence": confidence,
        "sleep_midpoint_avg_hour": round(avg_midpoint, 2),
        "social_jet_lag_minutes": social_jet_lag_minutes,
        "social_jet_lag_rating": social_jet_lag_rating,
        "optimal_bedtime_start": optimal_start,
        "optimal_bedtime_end": optimal_end,
        "n_days": n_days,
    }


def _classify_chronotype(avg_midpoint: float, n_days: int) -> tuple[str, str]:
    """Classify chronotype from average sleep midpoint.

    Boundaries (in 24h+ notation):
    - Early: midpoint < 26.5 (2:30 AM)
    - Intermediate: 26.5 <= midpoint < 27.5 (3:30 AM)
    - Late: midpoint >= 27.5
    """
    confidence = "moderate" if n_days >= 30 else "low"
    if n_days >= 60:
        confidence = "high"

    if avg_midpoint < 26.5:
        return "early", confidence
    if avg_midpoint < 27.5:
        return "intermediate", confidence
    return "late", confidence


def _compute_optimal_bedtime(df: pd.DataFrame) -> tuple[float | None, float | None]:
    """Find the bedtime window associated with the best sleep scores.

    Uses the top quartile of sleep scores and returns the bedtime range.
    """
    if "bedtime_hour" not in df.columns or "sleep_score" not in df.columns:
        return None, None

    subset = df[["bedtime_hour", "sleep_score"]].dropna()
    if len(subset) < 14:
        return None, None

    # Top quartile of sleep scores
    threshold = subset["sleep_score"].quantile(0.75)
    good_nights = subset[subset["sleep_score"] >= threshold]

    if len(good_nights) < 3:
        return None, None

    bedtimes = good_nights["bedtime_hour"]
    # Use mean ± 0.5 * std for the window
    mean_bt = float(bedtimes.mean())
    std_bt = float(bedtimes.std()) if len(bedtimes) > 1 else 0.5
    half_window = max(std_bt * 0.5, 0.25)  # at least 15 min window

    return round(mean_bt - half_window, 2), round(mean_bt + half_window, 2)


def _empty_result(n_days: int = 0) -> dict[str, Any]:
    return {
        "chronotype": None,
        "chronotype_confidence": None,
        "sleep_midpoint_avg_hour": None,
        "social_jet_lag_minutes": None,
        "social_jet_lag_rating": None,
        "optimal_bedtime_start": None,
        "optimal_bedtime_end": None,
        "n_days": n_days,
    }
