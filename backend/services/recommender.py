"""Recommendation engine — combines regression results with science thresholds."""

from __future__ import annotations

import datetime as dt
from typing import Any

import numpy as np
from sqlalchemy.orm import Session

from backend.models import Experiment, ExperimentStatus, SleepRecord
from backend.science.reference_data import (
    PREDICTOR_ACTIONS,
    SCIENCE_THRESHOLDS,
    ScienceThreshold,
)
from backend.services.sleep_timing import compute_sleep_timing
from backend.services.stats_engine import (
    PRIMARY_OUTCOMES,
    VARIABLE_LABELS,
    compute_regression,
    get_data_status,
    prepare_analysis_dataframe,
)

# Minimum recent days for science threshold evaluation
_MIN_RECENT_DAYS = 7
_RECENT_WINDOW = 14
_MAX_RECOMMENDATIONS = 20

# Base priority by category (lower = higher priority)
_BASE_PRIORITY: dict[str, int] = {
    "data_driven": 10,
    "timing": 15,
    "science_threshold": 20,
    "untried": 30,
}

_EVIDENCE_ADJ: dict[str, int] = {
    "very_high": -5,
    "high": -3,
    "moderate": 0,
    "low": 3,
}


def _evidence_from_n(n: int) -> str:
    """Map sample size to evidence level."""
    if n >= 90:
        return "very_high"
    if n >= 60:
        return "high"
    if n >= 30:
        return "moderate"
    return "low"


def _make_rec_id(category: str, factor: str, outcome: str | None = None) -> str:
    parts = [category, factor]
    if outcome:
        parts.append(outcome)
    return ":".join(parts)


def _data_driven_recs(df: "pd.DataFrame") -> list[dict[str, Any]]:
    """Generate recommendations from regression coefficients."""
    import pandas as pd  # noqa: F811

    recs: list[dict[str, Any]] = []

    for outcome in PRIMARY_OUTCOMES:
        result = compute_regression(df, outcome)
        if result is None:
            continue

        for coef in result["coefficients"]:
            # Skip non-significant
            if not coef["is_significant"]:
                continue
            # Skip lag1 autoregressive terms
            predictor = coef["predictor"]
            if predictor.endswith("_lag1"):
                continue
            # Skip if no action text available
            if predictor not in PREDICTOR_ACTIONS:
                continue

            coefficient = coef["coefficient"]
            direction = "positive" if coefficient > 0 else "negative"
            action_text = PREDICTOR_ACTIONS[predictor][direction]
            outcome_label = VARIABLE_LABELS.get(outcome, outcome)

            evidence = _evidence_from_n(result["n_days"])
            evidence_adj = _EVIDENCE_ADJ.get(evidence, 0)
            coef_adj = min(int(-abs(coefficient) * 5), -3)
            priority = max(1, _BASE_PRIORITY["data_driven"] + evidence_adj + coef_adj)

            body = action_text.format(outcome=outcome_label)
            body += f" (n={result['n_days']} days, p={coef['p_value']:.3f})."

            recs.append({
                "id": _make_rec_id("data_driven", predictor, outcome),
                "category": "data_driven",
                "priority": priority,
                "title": VARIABLE_LABELS.get(predictor, predictor),
                "body": body,
                "factor": predictor,
                "factor_label": VARIABLE_LABELS.get(predictor, predictor),
                "outcome": outcome,
                "outcome_label": outcome_label,
                "evidence_level": evidence,
                "n_days": result["n_days"],
            })

    return recs


def _science_threshold_recs(df: "pd.DataFrame") -> list[dict[str, Any]]:
    """Generate recommendations from science-backed thresholds."""
    recs: list[dict[str, Any]] = []

    # Use last _RECENT_WINDOW days
    if len(df) > _RECENT_WINDOW:
        recent = df.iloc[-_RECENT_WINDOW:]
    else:
        recent = df

    for thresh in SCIENCE_THRESHOLDS:
        if thresh.column not in recent.columns:
            continue

        values = recent[thresh.column].dropna()
        n_days = len(values)

        if n_days < _MIN_RECENT_DAYS:
            continue

        avg = float(values.mean())
        violated = False

        if thresh.comparison == "gt":
            violated = avg > thresh.threshold_value
        elif thresh.comparison == "lt":
            violated = avg < thresh.threshold_value
        elif thresh.comparison == "outside_range":
            # For room temp: below 65 or above 68
            low = thresh.threshold_value if thresh.range_upper is not None else thresh.threshold_value
            high = thresh.range_upper if thresh.range_upper is not None else thresh.threshold_value
            # For room_temp_f: threshold_value=68, we want outside 65-68
            if thresh.column == "room_temp_f":
                violated = avg < 65.0 or avg > 68.0
            else:
                violated = avg < low or avg > high

        if not violated:
            continue

        body = thresh.body_template.format(
            avg=avg, threshold=thresh.threshold_value, n_days=n_days
        )

        evidence_adj = _EVIDENCE_ADJ.get(thresh.evidence_level, 0)
        priority = max(1, _BASE_PRIORITY["science_threshold"] + evidence_adj)

        recs.append({
            "id": _make_rec_id("science_threshold", thresh.column),
            "category": "science_threshold",
            "priority": priority,
            "title": thresh.title,
            "body": body,
            "factor": thresh.column,
            "factor_label": thresh.label,
            "evidence_level": thresh.evidence_level,
            "suggested_experiment": thresh.experiment_template,
            "n_days": n_days,
        })

    return recs


def _untried_recs(df: "pd.DataFrame") -> list[dict[str, Any]]:
    """Suggest tracking factors the user hasn't tried much."""
    recs: list[dict[str, Any]] = []

    for thresh in SCIENCE_THRESHOLDS:
        if thresh.untried_title is None:
            continue

        if thresh.column not in df.columns:
            n_recorded = 0
        else:
            n_recorded = int(df[thresh.column].notna().sum())

        if n_recorded >= _MIN_RECENT_DAYS:
            continue

        priority = _BASE_PRIORITY["untried"]
        evidence_adj = _EVIDENCE_ADJ.get(thresh.evidence_level, 0)
        priority = max(1, priority + evidence_adj)

        recs.append({
            "id": _make_rec_id("untried", thresh.column),
            "category": "untried",
            "priority": priority,
            "title": thresh.untried_title,
            "body": thresh.untried_suggestion or "",
            "factor": thresh.column,
            "factor_label": thresh.label,
            "evidence_level": thresh.evidence_level,
            "suggested_experiment": thresh.experiment_template,
        })

    return recs


def _timing_recs(df: "pd.DataFrame") -> list[dict[str, Any]]:
    """Generate recommendations from sleep timing analysis."""
    recs: list[dict[str, Any]] = []

    timing = compute_sleep_timing(df)

    # Social jet lag > 60 minutes
    sjl = timing.get("social_jet_lag_minutes")
    if sjl is not None and sjl > 60:
        priority = max(1, _BASE_PRIORITY["timing"] + _EVIDENCE_ADJ["high"])
        recs.append({
            "id": _make_rec_id("timing", "social_jet_lag"),
            "category": "timing",
            "priority": priority,
            "title": "Consider more consistent sleep timing",
            "body": (
                f"Your weekend/weekday sleep midpoint differs by "
                f"{sjl:.0f} minutes. Research associates social jet lag "
                f"above 60 minutes with reduced sleep quality."
            ),
            "factor": "social_jet_lag",
            "factor_label": "Social Jet Lag",
            "evidence_level": "high",
            "suggested_experiment": (
                "Try keeping bedtime within 30 minutes of your weekday "
                "schedule on weekends for 2 weeks"
            ),
            "n_days": timing.get("n_days"),
        })

    # Recent bedtime later than optimal window by 30+ min
    optimal_end = timing.get("optimal_bedtime_end")
    if optimal_end is not None and "bedtime_hour" in df.columns:
        recent_bedtimes = df["bedtime_hour"].dropna()
        if len(recent_bedtimes) >= _MIN_RECENT_DAYS:
            recent_avg = float(recent_bedtimes.iloc[-_RECENT_WINDOW:].mean())
            if recent_avg > optimal_end + 0.5:  # 30+ min late
                priority = max(1, _BASE_PRIORITY["timing"] + _EVIDENCE_ADJ["high"])
                recs.append({
                    "id": _make_rec_id("timing", "bedtime_late"),
                    "category": "timing",
                    "priority": priority,
                    "title": "Consider an earlier bedtime",
                    "body": (
                        f"Your recent average bedtime is later than your "
                        f"personal optimal window by about "
                        f"{(recent_avg - optimal_end) * 60:.0f} minutes."
                    ),
                    "factor": "bedtime_hour",
                    "factor_label": "Bedtime",
                    "evidence_level": "high",
                    "n_days": len(recent_bedtimes),
                })

    return recs


def generate_recommendations(db: Session) -> dict[str, Any]:
    """Generate all recommendations for the user.

    Returns a dict matching RecommendationsResponse fields.
    """
    df = prepare_analysis_dataframe(db)
    status = get_data_status(df)
    total_days = status["total_sleep_days"]

    active_experiment = _get_active_experiment(db)

    if not status["phase_b_unlocked"]:
        return {
            "recommendations": [],
            "total_days": total_days,
            "has_sufficient_data": False,
            "active_experiment": active_experiment,
        }

    # Run all 4 generators
    all_recs: list[dict[str, Any]] = []
    all_recs.extend(_data_driven_recs(df))
    all_recs.extend(_science_threshold_recs(df))
    all_recs.extend(_untried_recs(df))
    all_recs.extend(_timing_recs(df))

    # Deduplicate by id (keep first = higher priority category)
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for rec in all_recs:
        if rec["id"] not in seen:
            seen.add(rec["id"])
            deduped.append(rec)

    # Sort by priority ascending, cap at max
    deduped.sort(key=lambda r: r["priority"])
    deduped = deduped[:_MAX_RECOMMENDATIONS]

    return {
        "recommendations": deduped,
        "total_days": total_days,
        "has_sufficient_data": True,
        "active_experiment": active_experiment,
    }


def get_top_recommendations(db: Session, limit: int = 3) -> list[dict[str, str]]:
    """Lightweight version for the dashboard — top N as {id, title, category}."""
    result = generate_recommendations(db)
    if not result["has_sufficient_data"]:
        return []
    return [
        {"id": r["id"], "title": r["title"], "category": r["category"]}
        for r in result["recommendations"][:limit]
    ]


def _get_active_experiment(db: Session) -> dict[str, Any] | None:
    """Get the current active experiment with computed metrics."""
    today = dt.date.today()

    experiment = (
        db.query(Experiment)
        .filter(Experiment.status == ExperimentStatus.ACTIVE)
        .first()
    )

    if experiment is None:
        return None

    # Auto-complete if end_date has passed
    if experiment.end_date < today:
        experiment.status = ExperimentStatus.COMPLETED
        db.commit()

    return _build_experiment_out(db, experiment, today)


def _build_experiment_out(
    db: Session, experiment: Experiment, today: dt.date | None = None
) -> dict[str, Any]:
    """Build an ExperimentOut dict with computed baseline/result metrics."""
    if today is None:
        today = dt.date.today()

    # Baseline: 14 days before start_date
    baseline_start = experiment.start_date - dt.timedelta(days=14)
    baseline_end = experiment.start_date - dt.timedelta(days=1)
    baseline_records = (
        db.query(SleepRecord)
        .filter(SleepRecord.date >= baseline_start, SleepRecord.date <= baseline_end)
        .all()
    )

    # Result: from start_date to min(end_date, today)
    result_end = min(experiment.end_date, today)
    result_records = (
        db.query(SleepRecord)
        .filter(SleepRecord.date >= experiment.start_date, SleepRecord.date <= result_end)
        .all()
    )

    days_completed = len(result_records)

    def _mean_or_none(records: list[SleepRecord], attr: str) -> float | None:
        vals = [getattr(r, attr) for r in records if getattr(r, attr) is not None]
        if not vals:
            return None
        return round(float(np.mean(vals)), 1)

    return {
        "id": experiment.id,
        "factor": experiment.factor,
        "factor_label": VARIABLE_LABELS.get(experiment.factor, experiment.factor),
        "hypothesis": experiment.hypothesis,
        "start_date": experiment.start_date,
        "end_date": experiment.end_date,
        "status": experiment.status,
        "notes": experiment.notes,
        "baseline_sleep_score": _mean_or_none(baseline_records, "sleep_score"),
        "baseline_deep_minutes": _mean_or_none(baseline_records, "deep_minutes"),
        "baseline_rem_minutes": _mean_or_none(baseline_records, "rem_minutes"),
        "baseline_hrv": _mean_or_none(baseline_records, "avg_hrv"),
        "result_sleep_score": _mean_or_none(result_records, "sleep_score"),
        "result_deep_minutes": _mean_or_none(result_records, "deep_minutes"),
        "result_rem_minutes": _mean_or_none(result_records, "rem_minutes"),
        "result_hrv": _mean_or_none(result_records, "avg_hrv"),
        "days_completed": days_completed,
    }


def get_experiment_by_id(db: Session, experiment_id: int) -> dict[str, Any] | None:
    """Get a single experiment with computed metrics."""
    experiment = db.get(Experiment, experiment_id)
    if experiment is None:
        return None

    today = dt.date.today()

    # Auto-complete if end_date has passed and still active
    if experiment.status == ExperimentStatus.ACTIVE and experiment.end_date < today:
        experiment.status = ExperimentStatus.COMPLETED
        db.commit()

    return _build_experiment_out(db, experiment, today)


def list_experiments(db: Session) -> list[dict[str, Any]]:
    """List all experiments with computed metrics."""
    today = dt.date.today()
    experiments = db.query(Experiment).order_by(Experiment.created_at.desc()).all()

    # Auto-complete any that have passed their end_date
    for exp in experiments:
        if exp.status == ExperimentStatus.ACTIVE and exp.end_date < today:
            exp.status = ExperimentStatus.COMPLETED
    if experiments:
        db.commit()

    return [_build_experiment_out(db, exp, today) for exp in experiments]
