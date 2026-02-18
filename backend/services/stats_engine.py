"""Statistical analysis engine — DataFrame prep, correlations, regression, outliers."""

from __future__ import annotations

import datetime as dt
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats
from sqlalchemy.orm import Session, joinedload

from backend.models import DailyLog, HabitType, SleepRecord
from backend.services.dashboard_service import _normalize_bedtime_hour

# --- Variable labels ---

VARIABLE_LABELS: dict[str, str] = {
    # Outcomes
    "sleep_score": "Sleep Score",
    "deep_minutes": "Deep Sleep (min)",
    "rem_minutes": "REM Sleep (min)",
    "avg_hrv": "HRV (ms)",
    "onset_latency_minutes": "Onset Latency (min)",
    "sleep_efficiency": "Sleep Efficiency",
    "total_sleep_minutes": "Total Sleep (min)",
    # Predictors
    "total_caffeine_mg": "Total Caffeine (mg)",
    "last_caffeine_hour": "Last Caffeine (hour)",
    "last_meal_hour": "Last Meal (hour)",
    "exercise_done": "Exercise",
    "exercise_duration_minutes": "Exercise Duration (min)",
    "alcohol": "Alcohol",
    "stress_level": "Stress Level",
    "room_temp_f": "Room Temp (F)",
    "blue_blockers": "Blue Blockers",
    "screens_off": "Screens Off",
    "sauna": "Sauna",
    "warm_shower": "Warm Shower",
    "stimulating_minutes": "Stimulating Activity (min)",
    "stimulating_last_hour": "Last Stimulating Activity (hour)",
    "nap_total_minutes": "Nap Duration (min)",
    "nap_count": "Nap Count",
    "sunlight_morning_minutes": "Morning Sunlight (min)",
    "sunlight_first_hour": "First Sunlight (hour)",
    "red_light_done": "Red Light Therapy",
    "red_light_dose_j_cm2": "Red Light Dose (J/cm²)",
    "nsdr_done": "NSDR",
    "nsdr_total_minutes": "NSDR Duration (min)",
    "ritual_done": "Pre-Bed Ritual",
    "ritual_total_minutes": "Ritual Duration (min)",
    "sexual_activity": "Sexual Activity",
    "sigma_7d": "Bedtime Variability (7d σ)",
    "delta_7d": "Bedtime Drift (7d δ)",
    "bedtime_hour": "Bedtime (hour)",
}

OUTCOME_COLUMNS = [
    "sleep_score",
    "deep_minutes",
    "rem_minutes",
    "avg_hrv",
    "onset_latency_minutes",
    "sleep_efficiency",
    "total_sleep_minutes",
]

PRIMARY_OUTCOMES = ["sleep_score", "deep_minutes", "rem_minutes", "avg_hrv"]

PREDICTOR_COLUMNS = [
    "total_caffeine_mg",
    "last_caffeine_hour",
    "last_meal_hour",
    "exercise_done",
    "exercise_duration_minutes",
    "alcohol",
    "stress_level",
    "room_temp_f",
    "blue_blockers",
    "screens_off",
    "sauna",
    "warm_shower",
    "stimulating_minutes",
    "stimulating_last_hour",
    "nap_total_minutes",
    "nap_count",
    "sunlight_morning_minutes",
    "sunlight_first_hour",
    "red_light_done",
    "red_light_dose_j_cm2",
    "nsdr_done",
    "nsdr_total_minutes",
    "ritual_done",
    "ritual_total_minutes",
    "sexual_activity",
    "sigma_7d",
    "delta_7d",
    "bedtime_hour",
]


def _time_to_hour(t: dt.time | None) -> float | None:
    """Convert a time object to decimal hours, or None."""
    if t is None:
        return None
    return t.hour + t.minute / 60


def _aggregate_daily_log(log: DailyLog) -> dict[str, Any]:
    """Aggregate all sub-entries of a DailyLog into flat numeric features."""
    row: dict[str, Any] = {"is_sick": True if log.is_sick else None}

    # Caffeine
    if log.caffeine_entries:
        row["total_caffeine_mg"] = sum(e.amount_mg for e in log.caffeine_entries)
        times = [_time_to_hour(e.time) for e in log.caffeine_entries if e.time is not None]
        row["last_caffeine_hour"] = max(times) if times else None
    else:
        row["total_caffeine_mg"] = None
        row["last_caffeine_hour"] = None

    # Meals
    meal_times = [_time_to_hour(e.time) for e in log.meal_entries if e.time is not None]
    last_meal_entries = [e for e in log.meal_entries if e.is_last_meal]
    if last_meal_entries and last_meal_entries[0].time is not None:
        row["last_meal_hour"] = _time_to_hour(last_meal_entries[0].time)
    elif meal_times:
        row["last_meal_hour"] = max(meal_times)
    else:
        row["last_meal_hour"] = None

    # Exercise
    exercise_entries = [e for e in log.habit_entries if e.habit_type == HabitType.EXERCISE]
    if exercise_entries:
        row["exercise_done"] = 1.0
        durations = [e.duration_minutes for e in exercise_entries if e.duration_minutes is not None]
        row["exercise_duration_minutes"] = sum(durations) if durations else None
    else:
        row["exercise_done"] = None
        row["exercise_duration_minutes"] = None

    # Binary habits
    habit_map = {
        HabitType.ALCOHOL: "alcohol",
        HabitType.BLUE_BLOCKERS_ON: "blue_blockers",
        HabitType.SCREENS_OFF: "screens_off",
        HabitType.SAUNA: "sauna",
        HabitType.WARM_SHOWER: "warm_shower",
    }
    for habit_type, col_name in habit_map.items():
        entries = [e for e in log.habit_entries if e.habit_type == habit_type]
        row[col_name] = 1.0 if entries else None

    # Stress level
    stress_entries = [e for e in log.habit_entries if e.habit_type == HabitType.STRESS_LEVEL]
    if stress_entries and stress_entries[0].value is not None:
        try:
            row["stress_level"] = float(stress_entries[0].value)
        except (ValueError, TypeError):
            row["stress_level"] = None
    else:
        row["stress_level"] = None

    # Room temp
    temp_entries = [e for e in log.habit_entries if e.habit_type == HabitType.ROOM_TEMP_F]
    if temp_entries and temp_entries[0].value is not None:
        try:
            row["room_temp_f"] = float(temp_entries[0].value)
        except (ValueError, TypeError):
            row["room_temp_f"] = None
    else:
        row["room_temp_f"] = None

    # Stimulating activities
    if log.stimulating_activity_entries:
        durations = [
            e.duration_minutes
            for e in log.stimulating_activity_entries
            if e.duration_minutes is not None
        ]
        row["stimulating_minutes"] = sum(durations) if durations else None
        end_times = [
            _time_to_hour(e.end_time)
            for e in log.stimulating_activity_entries
            if e.end_time is not None
        ]
        row["stimulating_last_hour"] = max(end_times) if end_times else None
    else:
        row["stimulating_minutes"] = None
        row["stimulating_last_hour"] = None

    # Naps
    if log.nap_entries:
        durations = [e.duration_minutes for e in log.nap_entries if e.duration_minutes is not None]
        row["nap_total_minutes"] = sum(durations) if durations else None
        row["nap_count"] = float(len(log.nap_entries))
    else:
        row["nap_total_minutes"] = None
        row["nap_count"] = None

    # Sunlight
    if log.sunlight_entries:
        morning_entries = [
            e for e in log.sunlight_entries
            if e.start_time is not None and e.start_time.hour < 12
        ]
        if morning_entries:
            durations = [
                e.duration_minutes for e in morning_entries if e.duration_minutes is not None
            ]
            row["sunlight_morning_minutes"] = sum(durations) if durations else None
            start_times = [
                _time_to_hour(e.start_time)
                for e in morning_entries
                if e.start_time is not None
            ]
            row["sunlight_first_hour"] = min(start_times) if start_times else None
        else:
            row["sunlight_morning_minutes"] = None
            row["sunlight_first_hour"] = None
    else:
        row["sunlight_morning_minutes"] = None
        row["sunlight_first_hour"] = None

    # Red light
    if log.red_light_entries:
        row["red_light_done"] = 1.0
        doses = [
            e.dose_joules_cm2
            for e in log.red_light_entries
            if e.dose_joules_cm2 is not None
        ]
        row["red_light_dose_j_cm2"] = sum(doses) if doses else None
    else:
        row["red_light_done"] = None
        row["red_light_dose_j_cm2"] = None

    # NSDR
    if log.nsdr_entries:
        row["nsdr_done"] = 1.0
        durations = [e.duration_minutes for e in log.nsdr_entries if e.duration_minutes is not None]
        row["nsdr_total_minutes"] = sum(durations) if durations else None
    else:
        row["nsdr_done"] = None
        row["nsdr_total_minutes"] = None

    # Pre-bed rituals
    if log.pre_bed_ritual_entries:
        row["ritual_done"] = 1.0
        durations = [
            e.duration_minutes
            for e in log.pre_bed_ritual_entries
            if e.duration_minutes is not None
        ]
        row["ritual_total_minutes"] = sum(durations) if durations else None
    else:
        row["ritual_done"] = None
        row["ritual_total_minutes"] = None

    # Sexual activity
    row["sexual_activity"] = 1.0 if log.sexual_activity_entry is not None else None

    return row


def prepare_analysis_dataframe(db: Session) -> pd.DataFrame:
    """Build a flat DataFrame joining SleepRecord + DailyLog sub-entries.

    One row per date. NaN for missing values (never zero). All analysis
    functions operate on this DataFrame.
    """
    # Query all sleep records
    sleep_records = db.query(SleepRecord).order_by(SleepRecord.date).all()

    if not sleep_records:
        return pd.DataFrame()

    sleep_rows = []
    for r in sleep_records:
        row: dict[str, Any] = {
            "date": r.date,
            "sleep_score": r.sleep_score,
            "deep_minutes": r.deep_minutes,
            "rem_minutes": r.rem_minutes,
            "avg_hrv": r.avg_hrv,
            "onset_latency_minutes": r.onset_latency_minutes,
            "sleep_efficiency": r.sleep_efficiency,
            "total_sleep_minutes": r.total_sleep_minutes,
        }

        # Derived time columns
        if r.bedtime is not None:
            row["bedtime_hour"] = _normalize_bedtime_hour(r.bedtime)
        else:
            row["bedtime_hour"] = None

        if r.wake_time is not None:
            row["wake_hour"] = r.wake_time.hour + r.wake_time.minute / 60
        else:
            row["wake_hour"] = None

        if r.bedtime is not None and r.wake_time is not None:
            bed_h = _normalize_bedtime_hour(r.bedtime)
            wake_h = r.wake_time.hour + r.wake_time.minute / 60
            if wake_h < 6:
                wake_h += 24
            row["sleep_midpoint_hour"] = (bed_h + wake_h) / 2
        else:
            row["sleep_midpoint_hour"] = None

        row["is_weekend"] = r.date.weekday() >= 5

        sleep_rows.append(row)

    sleep_df = pd.DataFrame(sleep_rows)
    sleep_df.set_index("date", inplace=True)

    # Query all daily logs with eager-loaded sub-entries
    daily_logs = (
        db.query(DailyLog)
        .options(
            joinedload(DailyLog.caffeine_entries),
            joinedload(DailyLog.meal_entries),
            joinedload(DailyLog.supplement_entries),
            joinedload(DailyLog.habit_entries),
            joinedload(DailyLog.stimulating_activity_entries),
            joinedload(DailyLog.sexual_activity_entry),
            joinedload(DailyLog.pre_bed_ritual_entries),
            joinedload(DailyLog.nap_entries),
            joinedload(DailyLog.sunlight_entries),
            joinedload(DailyLog.red_light_entries),
            joinedload(DailyLog.nsdr_entries),
        )
        .order_by(DailyLog.date)
        .all()
    )

    if daily_logs:
        log_rows = []
        for log in daily_logs:
            row = _aggregate_daily_log(log)
            row["date"] = log.date
            log_rows.append(row)

        log_df = pd.DataFrame(log_rows)
        log_df.set_index("date", inplace=True)

        # Left join: keep all sleep dates, merge in daily log data
        df = sleep_df.join(log_df, how="outer")
    else:
        df = sleep_df

    df.index.name = "date"
    df.sort_index(inplace=True)

    # Rolling consistency columns on bedtime_hour
    if "bedtime_hour" in df.columns:
        df["sigma_7d"] = (
            df["bedtime_hour"].rolling(window=7, min_periods=3).std() * 60
        )
        mean_7d = df["bedtime_hour"].rolling(window=7, min_periods=3).mean()
        df["delta_7d"] = (df["bedtime_hour"] - mean_7d).abs() * 60
    else:
        df["sigma_7d"] = np.nan
        df["delta_7d"] = np.nan

    return df


def get_data_status(df: pd.DataFrame) -> dict[str, Any]:
    """Compute per-variable day counts and phase unlock status."""
    if df.empty:
        return {
            "total_sleep_days": 0,
            "phase_a_unlocked": False,
            "phase_b_unlocked": False,
            "phase_c_unlocked": False,
            "variables": [],
        }

    all_columns = [c for c in PREDICTOR_COLUMNS + OUTCOME_COLUMNS if c in df.columns]
    total_sleep = int(df["sleep_score"].notna().sum()) if "sleep_score" in df.columns else 0

    variables = []
    max_n = 0
    for col in all_columns:
        n = int(df[col].notna().sum())
        if n > max_n:
            max_n = n
        variables.append({
            "name": col,
            "label": VARIABLE_LABELS.get(col, col),
            "n_days": n,
            "has_correlations": n >= 14,
            "has_regression": n >= 50,
        })

    # Check bedtime data for phase C
    bedtime_days = int(df["bedtime_hour"].notna().sum()) if "bedtime_hour" in df.columns else 0

    return {
        "total_sleep_days": total_sleep,
        "phase_a_unlocked": any(v["has_correlations"] for v in variables),
        "phase_b_unlocked": any(v["has_regression"] for v in variables),
        "phase_c_unlocked": bedtime_days >= 30,
        "variables": variables,
    }


def _confidence_level(n: int) -> str:
    """Classify sample size confidence."""
    if n >= 50:
        return "high"
    if n >= 30:
        return "moderate"
    return "low"


def compute_correlations(
    df: pd.DataFrame,
    min_days: int = 14,
) -> tuple[list[dict[str, Any]], int]:
    """Compute pairwise correlations between predictors and outcomes.

    Returns (results, excluded_sick_days).
    """
    if df.empty:
        return [], 0

    # Filter sick days
    sick_count = 0
    if "is_sick" in df.columns:
        sick_mask = df["is_sick"] == True  # noqa: E712
        sick_count = int(sick_mask.sum())
        df = df[~sick_mask]

    results: list[dict[str, Any]] = []

    predictors = [c for c in PREDICTOR_COLUMNS if c in df.columns]
    outcomes = [c for c in OUTCOME_COLUMNS if c in df.columns]

    for pred in predictors:
        for outcome in outcomes:
            subset = df[[pred, outcome]].dropna()
            n = len(subset)
            if n < min_days:
                continue

            # Need variance in both columns
            if subset[pred].std() == 0 or subset[outcome].std() == 0:
                continue

            pearson_r, p_val = stats.pearsonr(subset[pred], subset[outcome])
            spearman_r, _ = stats.spearmanr(subset[pred], subset[outcome])

            # Skip if result is NaN (can happen with near-constant data)
            if np.isnan(pearson_r) or np.isnan(spearman_r):
                continue

            results.append({
                "predictor": pred,
                "predictor_label": VARIABLE_LABELS.get(pred, pred),
                "outcome": outcome,
                "outcome_label": VARIABLE_LABELS.get(outcome, outcome),
                "pearson_r": round(float(pearson_r), 4),
                "spearman_r": round(float(spearman_r), 4),
                "p_value": round(float(p_val), 6),
                "n_days": n,
                "confidence": _confidence_level(n),
            })

    # Sort by absolute pearson_r descending
    results.sort(key=lambda r: abs(r["pearson_r"]), reverse=True)

    return results, sick_count


def detect_outliers(
    df: pd.DataFrame,
    columns: list[str] | None = None,
    z_threshold: float = 3.0,
) -> dict[str, list[Any]]:
    """Detect outliers using z-score method.

    Returns dict mapping column name to list of (date, value, z_score) tuples.
    """
    if df.empty:
        return {}

    if columns is None:
        columns = [c for c in OUTCOME_COLUMNS + PREDICTOR_COLUMNS if c in df.columns]

    outliers: dict[str, list[Any]] = {}

    for col in columns:
        if col not in df.columns:
            continue

        series = df[col].dropna()
        if len(series) < 3:
            continue

        mean = series.mean()
        std = series.std()
        if std == 0:
            continue

        z_scores = (series - mean) / std
        mask = z_scores.abs() > z_threshold

        if mask.any():
            outliers[col] = [
                {
                    "date": str(idx),
                    "value": round(float(series[idx]), 2),
                    "z_score": round(float(z_scores[idx]), 2),
                }
                for idx in z_scores[mask].index
            ]

    return outliers


def compute_regression(
    df: pd.DataFrame,
    outcome: str,
    min_days: int = 50,
) -> dict[str, Any] | None:
    """Fit OLS regression for a single outcome variable.

    Returns None if insufficient data.
    """
    import statsmodels.api as sm
    from statsmodels.stats.outliers_influence import variance_inflation_factor
    from statsmodels.tsa.stattools import acf, adfuller

    if df.empty or outcome not in df.columns:
        return None

    # Filter sick days
    work_df = df.copy()
    if "is_sick" in work_df.columns:
        work_df = work_df[work_df["is_sick"] != True]  # noqa: E712

    # Select predictors with enough non-NaN data
    available_predictors = []
    for col in PREDICTOR_COLUMNS:
        if col not in work_df.columns:
            continue
        n_valid = work_df[[col, outcome]].dropna().shape[0]
        if n_valid >= min_days:
            available_predictors.append(col)

    if not available_predictors:
        return None

    # Add lag-1 of outcome as autoregressive predictor
    work_df[f"{outcome}_lag1"] = work_df[outcome].shift(1)
    all_predictors = available_predictors + [f"{outcome}_lag1"]

    # Drop rows with any NaN in selected columns
    cols_needed = [outcome] + all_predictors
    cols_present = [c for c in cols_needed if c in work_df.columns]
    clean_df = work_df[cols_present].dropna()

    if len(clean_df) < min_days:
        return None

    y = clean_df[outcome]
    X = clean_df[[c for c in all_predictors if c in clean_df.columns]]

    # Standardize predictors for comparable coefficients
    X_means = X.mean()
    X_stds = X.std()
    # Avoid division by zero for constant columns
    X_stds = X_stds.replace(0, 1)
    X_scaled = (X - X_means) / X_stds

    X_const = sm.add_constant(X_scaled)

    try:
        model = sm.OLS(y, X_const).fit()
    except Exception:
        return None

    # Compute VIF for each predictor
    excluded_predictors: list[str] = []
    multicollinearity_warning = False
    vif_values: dict[str, float] = {}

    if X_scaled.shape[1] > 1:
        for i, col in enumerate(X_scaled.columns):
            try:
                vif = variance_inflation_factor(X_scaled.values, i)
                if np.isfinite(vif):
                    vif_values[col] = round(float(vif), 2)
                    if vif > 5.0:
                        multicollinearity_warning = True
                else:
                    vif_values[col] = None
            except Exception:
                vif_values[col] = None

    # ADF test on residuals
    is_stationary = True
    try:
        adf_result = adfuller(model.resid, autolag="AIC")
        is_stationary = bool(adf_result[1] < 0.05)
    except Exception:
        pass

    # ACF on residuals — check for autocorrelation
    has_autocorrelation = False
    try:
        acf_values = acf(model.resid, nlags=5, fft=False)
        # Significant if any lag 1-5 exceeds 2/sqrt(n) threshold
        threshold = 2 / np.sqrt(len(model.resid))
        has_autocorrelation = bool(any(abs(acf_values[i]) > threshold for i in range(1, min(6, len(acf_values)))))
    except Exception:
        pass

    # Sanitize r_squared values
    r_sq = float(model.rsquared)
    adj_r_sq = float(model.rsquared_adj)
    if not np.isfinite(r_sq):
        r_sq = 0.0
    if not np.isfinite(adj_r_sq):
        adj_r_sq = 0.0

    # Build coefficient list (skip constant)
    coefficients = []
    predictor_cols = [c for c in all_predictors if c in clean_df.columns]
    for col in predictor_cols:
        if col not in model.params.index:
            continue
        coef = float(model.params[col])
        ci = model.conf_int().loc[col]
        p_val = float(model.pvalues[col])

        # Skip coefficients with non-finite values
        if not np.isfinite(coef) or not np.isfinite(p_val):
            continue

        coefficients.append({
            "predictor": col,
            "predictor_label": VARIABLE_LABELS.get(col, col),
            "coefficient": round(coef, 4),
            "ci_lower": round(float(ci[0]), 4) if np.isfinite(ci[0]) else None,
            "ci_upper": round(float(ci[1]), 4) if np.isfinite(ci[1]) else None,
            "p_value": round(p_val, 6),
            "is_significant": p_val < 0.05,
            "vif": vif_values.get(col),
        })

    return {
        "outcome": outcome,
        "outcome_label": VARIABLE_LABELS.get(outcome, outcome),
        "n_days": len(clean_df),
        "r_squared": round(r_sq, 4),
        "adj_r_squared": round(adj_r_sq, 4),
        "coefficients": coefficients,
        "has_autocorrelation": has_autocorrelation,
        "is_stationary": is_stationary,
        "multicollinearity_warning": multicollinearity_warning,
        "excluded_predictors": excluded_predictors,
    }
