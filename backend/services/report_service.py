"""Report service — weekly and monthly summary computation + HTML export."""

from __future__ import annotations

import calendar
import datetime as dt
import statistics
from typing import Any

from sqlalchemy.orm import Session, joinedload

from backend.models import DailyLog, HabitType, SleepRecord, UserSettings
from backend.science.reference_data import get_stage_targets
from backend.services.dashboard_service import _compute_consistency

# ---------------------------------------------------------------------------
# Date range helpers
# ---------------------------------------------------------------------------


def _week_date_range(iso_year: int, iso_week: int) -> tuple[dt.date, dt.date]:
    """Return (monday, sunday) for the given ISO year/week."""
    monday = dt.date.fromisocalendar(iso_year, iso_week, 1)
    sunday = monday + dt.timedelta(days=6)
    return monday, sunday


def _month_date_range(year: int, month: int) -> tuple[dt.date, dt.date]:
    """Return (first_day, last_day) for the given year/month."""
    first_day = dt.date(year, month, 1)
    last_day = dt.date(year, month, calendar.monthrange(year, month)[1])
    return first_day, last_day


def _weeks_in_month(year: int, month: int) -> list[tuple[int, int]]:
    """Return list of (iso_year, iso_week) for weeks whose Monday falls in the month."""
    first_day, last_day = _month_date_range(year, month)
    # Walk to the first Monday on or after first_day
    d = first_day
    while d.weekday() != 0:
        d += dt.timedelta(days=1)

    weeks: list[tuple[int, int]] = []
    while d <= last_day:
        iso_year, iso_week, _ = d.isocalendar()
        weeks.append((iso_year, iso_week))
        d += dt.timedelta(days=7)
    return weeks


# ---------------------------------------------------------------------------
# Metric computation helpers
# ---------------------------------------------------------------------------


def _compute_metric_averages(records: list[SleepRecord]) -> dict[str, Any]:
    """Compute mean of key metrics, filtering None per-metric."""
    scores = [r.sleep_score for r in records if r.sleep_score is not None]
    hrvs = [r.avg_hrv for r in records if r.avg_hrv is not None]
    deeps = [r.deep_minutes for r in records if r.deep_minutes is not None]
    rems = [r.rem_minutes for r in records if r.rem_minutes is not None]

    return {
        "avg_sleep_score": round(statistics.mean(scores), 1) if scores else None,
        "avg_hrv": round(statistics.mean(hrvs), 1) if hrvs else None,
        "avg_deep_minutes": round(statistics.mean(deeps), 1) if deeps else None,
        "avg_rem_minutes": round(statistics.mean(rems), 1) if rems else None,
    }


def _compute_trend_arrows(current: dict[str, Any], prior: dict[str, Any]) -> dict[str, Any]:
    """Compare current vs prior averages. Returns up/down/flat per metric."""
    mapping = {
        "sleep_score": ("avg_sleep_score", "avg_sleep_score"),
        "avg_hrv": ("avg_hrv", "avg_hrv"),
        "deep_minutes": ("avg_deep_minutes", "avg_deep_minutes"),
        "rem_minutes": ("avg_rem_minutes", "avg_rem_minutes"),
    }
    arrows: dict[str, Any] = {}
    for key, (cur_field, pri_field) in mapping.items():
        cur = current.get(cur_field)
        pri = prior.get(pri_field)
        if cur is None or pri is None or pri == 0:
            arrows[key] = None
            continue
        delta_pct = (cur - pri) / abs(pri) * 100
        if abs(delta_pct) < 2:
            arrows[key] = "flat"
        elif delta_pct > 0:
            arrows[key] = "up"
        else:
            arrows[key] = "down"
    return arrows


def _metric_rows_html(cur: dict[str, Any], pri: dict[str, Any], trends: dict[str, Any]) -> str:
    """Render the four standard metric table rows shared by weekly/monthly reports."""
    specs = [
        ("Sleep Score", "avg_sleep_score", "sleep_score", ""),
        ("HRV", "avg_hrv", "avg_hrv", ""),
        ("Deep Sleep", "avg_deep_minutes", "deep_minutes", " min"),
        ("REM Sleep", "avg_rem_minutes", "rem_minutes", " min"),
    ]
    rows = []
    for label, field, trend_key, unit in specs:
        rows.append(
            f"<tr><td>{label}</td>"
            f"<td>{_fmt(cur.get(field))}{unit}</td>"
            f"<td>{_fmt(pri.get(field))}{unit}</td>"
            f"<td>{_trend_html(trends.get(trend_key))}</td></tr>"
        )
    return "\n".join(rows)


def _get_top_factors(db: Session) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """Return (top_positive, top_negative) factor from full-dataset correlations."""
    from backend.services.stats_engine import (
        VARIABLE_LABELS,
        compute_correlations,
        prepare_analysis_dataframe,
    )

    df = prepare_analysis_dataframe(db)
    if df.empty:
        return None, None

    results, _ = compute_correlations(df)
    # Filter to sleep_score outcome only
    sleep_corrs = [r for r in results if r["outcome"] == "sleep_score"]
    if not sleep_corrs:
        return None, None

    positive = [r for r in sleep_corrs if r["pearson_r"] > 0]
    negative = [r for r in sleep_corrs if r["pearson_r"] < 0]

    top_pos = None
    top_neg = None
    if positive:
        best = max(positive, key=lambda r: r["pearson_r"])
        top_pos = {
            "label": VARIABLE_LABELS.get(best["predictor"], best["predictor"]),
            "pearson_r": best["pearson_r"],
        }
    if negative:
        worst = min(negative, key=lambda r: r["pearson_r"])
        top_neg = {
            "label": VARIABLE_LABELS.get(worst["predictor"], worst["predictor"]),
            "pearson_r": worst["pearson_r"],
        }
    return top_pos, top_neg


def _get_contributing_factors(db: Session, date: dt.date) -> list[str]:
    """Build human-readable factor list from a DailyLog's sub-entries."""
    log = (
        db.query(DailyLog)
        .options(
            joinedload(DailyLog.caffeine_entries),
            joinedload(DailyLog.meal_entries),
            joinedload(DailyLog.supplement_entries),
            joinedload(DailyLog.habit_entries),
            joinedload(DailyLog.sunlight_entries),
            joinedload(DailyLog.pre_bed_ritual_entries),
            joinedload(DailyLog.nap_entries),
            joinedload(DailyLog.nsdr_entries),
            joinedload(DailyLog.sexual_activity_entry),
        )
        .filter(DailyLog.date == date)
        .first()
    )
    if log is None:
        return []

    factors: list[str] = []

    # Exercise
    exercise = [e for e in log.habit_entries if e.habit_type == HabitType.EXERCISE]
    if exercise:
        factors.append("Exercised")

    # Alcohol
    alcohol = [e for e in log.habit_entries if e.habit_type == HabitType.ALCOHOL]
    if alcohol:
        factors.append("Alcohol")
    else:
        # Only say "No alcohol" if there's at least some entries (user was logging)
        if log.habit_entries:
            factors.append("No alcohol")

    # Blue blockers
    bb = [e for e in log.habit_entries if e.habit_type == HabitType.BLUE_BLOCKERS_ON]
    if bb:
        factors.append("Blue blockers on")

    # Caffeine
    if log.caffeine_entries:
        total_mg = sum(e.amount_mg for e in log.caffeine_entries)
        factors.append(f"Caffeine: {total_mg}mg total")

    # Morning sunlight
    morning_sun = [
        e for e in log.sunlight_entries if e.start_time is not None and e.start_time.hour < 12
    ]
    if morning_sun:
        durations = [e.duration_minutes for e in morning_sun if e.duration_minutes is not None]
        if durations:
            factors.append(f"Morning sunlight: {sum(durations)} min")

    # Pre-bed rituals
    if log.pre_bed_ritual_entries:
        factors.append("Pre-bed ritual")

    # Naps
    if log.nap_entries:
        durations = [e.duration_minutes for e in log.nap_entries if e.duration_minutes is not None]
        if durations:
            factors.append(f"Napped {sum(durations)} min")

    # NSDR
    if log.nsdr_entries:
        factors.append("NSDR")

    return factors


def _compute_stage_compliance(records: list[SleepRecord], age: int | None) -> dict[str, Any] | None:
    """Count nights hitting deep/REM targets. Returns None if no age set."""
    targets = get_stage_targets(age)
    if targets is None:
        return None

    deep_records = [r for r in records if r.deep_minutes is not None]
    rem_records = [r for r in records if r.rem_minutes is not None]

    if not deep_records and not rem_records:
        return None

    deep_target_nights = sum(
        1
        for r in deep_records
        if r.deep_minutes is not None and r.deep_minutes >= targets.deep_min_minutes
    )
    rem_target_nights = sum(
        1
        for r in rem_records
        if r.rem_minutes is not None and r.rem_minutes >= targets.rem_min_minutes
    )

    return {
        "deep_target_nights": deep_target_nights,
        "deep_total_nights": len(deep_records),
        "rem_target_nights": rem_target_nights,
        "rem_total_nights": len(rem_records),
    }


# ---------------------------------------------------------------------------
# Weekly report
# ---------------------------------------------------------------------------


def get_week_report(
    db: Session,
    iso_year: int | None = None,
    iso_week: int | None = None,
    today: dt.date | None = None,
) -> dict[str, Any]:
    """Compute a weekly summary report."""
    if today is None:
        today = dt.date.today()

    if iso_year is None or iso_week is None:
        iso_year, iso_week, _ = today.isocalendar()

    monday, sunday = _week_date_range(iso_year, iso_week)

    # Query records in range
    records = (
        db.query(SleepRecord)
        .filter(SleepRecord.date >= monday, SleepRecord.date <= sunday)
        .order_by(SleepRecord.date)
        .all()
    )

    # Count daily logs in range
    log_count = db.query(DailyLog).filter(DailyLog.date >= monday, DailyLog.date <= sunday).count()

    days_with_data = len(records)

    if days_with_data < 2:
        return {
            "period_start": monday,
            "period_end": sunday,
            "iso_year": iso_year,
            "iso_week": iso_week,
            "days_with_data": days_with_data,
            "days_in_period": 7,
            "logging_completeness": f"{log_count}/7 days",
            "current": _compute_metric_averages(records),
            "prior": _compute_metric_averages([]),
            "trends": _compute_trend_arrows(
                _compute_metric_averages(records), _compute_metric_averages([])
            ),
            "consistency": None,
            "top_positive_factor": None,
            "top_negative_factor": None,
            "has_insufficient_data": True,
        }

    current = _compute_metric_averages(records)

    # Prior week
    prior_monday = monday - dt.timedelta(days=7)
    prior_sunday = monday - dt.timedelta(days=1)
    prior_records = (
        db.query(SleepRecord)
        .filter(SleepRecord.date >= prior_monday, SleepRecord.date <= prior_sunday)
        .order_by(SleepRecord.date)
        .all()
    )
    prior = _compute_metric_averages(prior_records)
    trends = _compute_trend_arrows(current, prior)

    # Consistency
    settings = db.get(UserSettings, 1)
    typical_bedtime = settings.typical_bedtime if settings else None
    consistency = _compute_consistency(records, typical_bedtime)

    # Top factors (full dataset)
    top_pos, top_neg = _get_top_factors(db)

    return {
        "period_start": monday,
        "period_end": sunday,
        "iso_year": iso_year,
        "iso_week": iso_week,
        "days_with_data": days_with_data,
        "days_in_period": 7,
        "logging_completeness": f"{log_count}/7 days",
        "current": current,
        "prior": prior,
        "trends": trends,
        "consistency": consistency,
        "top_positive_factor": top_pos,
        "top_negative_factor": top_neg,
        "has_insufficient_data": False,
    }


# ---------------------------------------------------------------------------
# Monthly report
# ---------------------------------------------------------------------------


def get_month_report(
    db: Session,
    year: int | None = None,
    month: int | None = None,
    today: dt.date | None = None,
) -> dict[str, Any]:
    """Compute a monthly summary report."""
    if today is None:
        today = dt.date.today()

    if year is None or month is None:
        year = today.year
        month = today.month

    first_day, last_day = _month_date_range(year, month)
    days_in_period = (last_day - first_day).days + 1

    records = (
        db.query(SleepRecord)
        .filter(SleepRecord.date >= first_day, SleepRecord.date <= last_day)
        .order_by(SleepRecord.date)
        .all()
    )

    log_count = (
        db.query(DailyLog).filter(DailyLog.date >= first_day, DailyLog.date <= last_day).count()
    )

    days_with_data = len(records)
    month_name = calendar.month_name[month]

    if days_with_data < 4:
        return {
            "period_start": first_day,
            "period_end": last_day,
            "year": year,
            "month": month,
            "month_name": month_name,
            "days_with_data": days_with_data,
            "days_in_period": days_in_period,
            "logging_completeness": f"{log_count}/{days_in_period} days",
            "current": _compute_metric_averages(records),
            "prior": _compute_metric_averages([]),
            "trends": _compute_trend_arrows(
                _compute_metric_averages(records), _compute_metric_averages([])
            ),
            "best_night": None,
            "worst_night": None,
            "stage_compliance": None,
            "active_experiment": None,
            "weekly_summaries": [],
            "has_insufficient_data": True,
        }

    current = _compute_metric_averages(records)

    # Prior month
    if month == 1:
        prior_year, prior_month = year - 1, 12
    else:
        prior_year, prior_month = year, month - 1
    prior_first, prior_last = _month_date_range(prior_year, prior_month)
    prior_records = (
        db.query(SleepRecord)
        .filter(SleepRecord.date >= prior_first, SleepRecord.date <= prior_last)
        .order_by(SleepRecord.date)
        .all()
    )
    prior = _compute_metric_averages(prior_records)
    trends = _compute_trend_arrows(current, prior)

    # Best / worst nights
    scored = [r for r in records if r.sleep_score is not None]
    best_night = None
    worst_night = None
    if scored:
        best = max(scored, key=lambda r: r.sleep_score or 0)
        worst = min(scored, key=lambda r: r.sleep_score or 0)
        best_night = {
            "date": best.date,
            "sleep_score": best.sleep_score,
            "contributing_factors": _get_contributing_factors(db, best.date),
        }
        worst_night = {
            "date": worst.date,
            "sleep_score": worst.sleep_score,
            "contributing_factors": _get_contributing_factors(db, worst.date),
        }

    # Stage compliance
    settings = db.get(UserSettings, 1)
    age = settings.age if settings else None
    stage_compliance = _compute_stage_compliance(records, age)

    # Active experiment
    from backend.services.recommender import _get_active_experiment

    active_experiment = _get_active_experiment(db)

    # Weekly summaries
    weeks = _weeks_in_month(year, month)
    weekly_summaries = [get_week_report(db, wy, ww, today=today) for wy, ww in weeks]

    return {
        "period_start": first_day,
        "period_end": last_day,
        "year": year,
        "month": month,
        "month_name": month_name,
        "days_with_data": days_with_data,
        "days_in_period": days_in_period,
        "logging_completeness": f"{log_count}/{days_in_period} days",
        "current": current,
        "prior": prior,
        "trends": trends,
        "best_night": best_night,
        "worst_night": worst_night,
        "stage_compliance": stage_compliance,
        "active_experiment": active_experiment,
        "weekly_summaries": weekly_summaries,
        "has_insufficient_data": False,
    }


# ---------------------------------------------------------------------------
# HTML rendering
# ---------------------------------------------------------------------------

_CIRCADIAN_CSS = """
body {
    background: #1a0500;
    color: #ff8c00;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    max-width: 700px;
    margin: 2rem auto;
    padding: 1rem;
    line-height: 1.5;
}
h1, h2, h3 {
    color: #ff8c00;
    border-bottom: 1px solid #3d1a00;
    padding-bottom: 0.5rem;
}
table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
}
th, td {
    text-align: left;
    padding: 0.5rem;
    border-bottom: 1px solid #3d1a00;
}
th { color: #ff6b6b; }
.trend-up { color: #44cc44; }
.trend-down { color: #ff6b6b; }
.trend-flat { color: #888; }
.muted { color: #996633; }
.factor-tag {
    display: inline-block;
    background: #3d1a00;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    margin: 0.15rem;
    font-size: 0.85rem;
}
@media print {
    body { background: #fff; color: #333; }
    h1, h2, h3 { color: #333; border-color: #ccc; }
    th { color: #666; }
    th, td { border-color: #ccc; }
    .factor-tag { background: #eee; }
}
"""


def _trend_html(value: str | None) -> str:
    """Render a trend arrow as HTML span."""
    if value == "up":
        return '<span class="trend-up">&#8593;</span>'
    if value == "down":
        return '<span class="trend-down">&#8595;</span>'
    if value == "flat":
        return '<span class="trend-flat">&#8594;</span>'
    return '<span class="muted">—</span>'


def _fmt(value: float | None, decimals: int = 1) -> str:
    if value is None:
        return "—"
    return f"{value:.{decimals}f}"


def render_weekly_html(report: dict[str, Any]) -> str:
    """Render a weekly report as a self-contained HTML page."""
    r = report
    cur = r["current"]
    pri = r["prior"]
    trends = r["trends"]

    factors_html = ""
    if r.get("top_positive_factor"):
        f = r["top_positive_factor"]
        factors_html += (
            f"<p>Associated with better sleep score: "
            f"<strong>{f['label']}</strong> (r={f['pearson_r']:.3f})</p>"
        )
    if r.get("top_negative_factor"):
        f = r["top_negative_factor"]
        factors_html += (
            f"<p>Associated with worse sleep score: "
            f"<strong>{f['label']}</strong> (r={f['pearson_r']:.3f})</p>"
        )

    consistency_html = ""
    if r.get("consistency"):
        c = r["consistency"]
        consistency_html = f"""
        <h3>Bedtime Consistency</h3>
        <table>
            <tr><th>Metric</th><th>Value</th><th>Rating</th></tr>
            <tr><td>Variability (&#963;)</td>
                <td>{c["sigma_minutes"]:.0f} min</td><td>{c["sigma_rating"]}</td></tr>
        """
        if c.get("delta_minutes") is not None:
            consistency_html += (
                f"<tr><td>Offset (&#948;)</td>"
                f"<td>{c['delta_minutes']:.0f} min</td><td>{c['delta_rating']}</td></tr>"
            )
        if c.get("weekend_drift_minutes") is not None:
            consistency_html += (
                f"<tr><td>Weekend Drift (&#916;)</td>"
                f"<td>{c['weekend_drift_minutes']:.0f} min</td><td>{c['drift_rating']}</td></tr>"
            )
        consistency_html += "</table>"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Somnus Weekly Report — Week {r["iso_week"]}, {r["iso_year"]}</title>
<style>{_CIRCADIAN_CSS}</style>
</head>
<body>
<h1>Weekly Report</h1>
<p>{r["period_start"]} to {r["period_end"]} (Week {r["iso_week"]}, {r["iso_year"]})</p>
<p class="muted">Logged {r["logging_completeness"]}</p>

{"<p><em>Insufficient data for full analysis.</em></p>" if r["has_insufficient_data"] else ""}

<h2>Metrics</h2>
<table>
<tr><th>Metric</th><th>This Week</th><th>Prior Week</th><th>Trend</th></tr>
{_metric_rows_html(cur, pri, trends)}
</table>

{consistency_html}

{f"<h2>Top Factors</h2>{factors_html}" if factors_html else ""}

<footer class="muted" style="margin-top:2rem;font-size:0.8rem;">Generated by Somnus</footer>
</body>
</html>"""


def render_monthly_html(report: dict[str, Any]) -> str:
    """Render a monthly report as a self-contained HTML page."""
    r = report
    cur = r["current"]
    pri = r["prior"]
    trends = r["trends"]

    best_worst_html = ""
    if r.get("best_night"):
        b = r["best_night"]
        tags = "".join(
            f'<span class="factor-tag">{f}</span>' for f in b.get("contributing_factors", [])
        )
        best_worst_html += (
            f"<h3>Best Night</h3><p>{b['date']} — Score: {b['sleep_score']}</p>{tags}"
        )
    if r.get("worst_night"):
        w = r["worst_night"]
        tags = "".join(
            f'<span class="factor-tag">{f}</span>' for f in w.get("contributing_factors", [])
        )
        best_worst_html += (
            f"<h3>Worst Night</h3><p>{w['date']} — Score: {w['sleep_score']}</p>{tags}"
        )

    compliance_html = ""
    if r.get("stage_compliance"):
        sc = r["stage_compliance"]
        compliance_html = f"""
        <h2>Stage Compliance</h2>
        <p>Hit deep sleep target: {sc["deep_target_nights"]}/{sc["deep_total_nights"]} nights</p>
        <p>Hit REM target: {sc["rem_target_nights"]}/{sc["rem_total_nights"]} nights</p>
        """

    experiment_html = ""
    if r.get("active_experiment"):
        exp = r["active_experiment"]
        factor_label = exp.get("factor_label", exp.get("factor", ""))
        experiment_html = f"""
        <h2>Active Experiment</h2>
        <p><strong>{factor_label}</strong>: {exp.get("hypothesis", "")}</p>
        <p>{exp.get("start_date", "")} to {exp.get("end_date", "")}
        — {exp.get("days_completed", 0)} days completed</p>
        """

    weekly_html = ""
    if r.get("weekly_summaries"):
        rows = ""
        for ws in r["weekly_summaries"]:
            wc = ws["current"]
            rows += (
                f"<tr><td>Wk {ws['iso_week']}</td>"
                f"<td>{_fmt(wc.get('avg_sleep_score'))}</td>"
                f"<td>{_fmt(wc.get('avg_hrv'))}</td>"
                f"<td>{_fmt(wc.get('avg_deep_minutes'))}</td>"
                f"<td>{_fmt(wc.get('avg_rem_minutes'))}</td></tr>"
            )
        weekly_html = f"""
        <h2>Weekly Breakdown</h2>
        <table>
        <tr><th>Week</th><th>Score</th><th>HRV</th><th>Deep</th><th>REM</th></tr>
        {rows}
        </table>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Somnus Monthly Report — {r["month_name"]} {r["year"]}</title>
<style>{_CIRCADIAN_CSS}</style>
</head>
<body>
<h1>Monthly Report — {r["month_name"]} {r["year"]}</h1>
<p>{r["period_start"]} to {r["period_end"]}</p>
<p class="muted">Logged {r["logging_completeness"]}</p>

{"<p><em>Insufficient data for full analysis.</em></p>" if r["has_insufficient_data"] else ""}

<h2>Metrics</h2>
<table>
<tr><th>Metric</th><th>This Month</th><th>Prior Month</th><th>Trend</th></tr>
{_metric_rows_html(cur, pri, trends)}
</table>

{best_worst_html}
{compliance_html}
{experiment_html}
{weekly_html}

<footer class="muted" style="margin-top:2rem;font-size:0.8rem;">Generated by Somnus</footer>
</body>
</html>"""
