# ADR 012: Reports Architecture

## Status
Accepted

## Context
With Steps 1–7 complete (data collection, analysis engine, recommendations, dashboard), users need periodic summary reports to track their progress over time. Weekly and monthly summaries help users see trends and evaluate whether behavioral changes are working.

Key considerations:
- Reports should be computed on-the-fly, not persisted, to avoid stale data
- Weekly reports use ISO week boundaries (Monday–Sunday) for consistency
- Top factors should use full-dataset correlations (not within-period) to maintain statistical power
- HTML export should use the circadian palette for print-to-PDF
- No new dependencies needed

## Decision

### On-the-fly Computation
Reports are computed at request time from existing SleepRecord and DailyLog data, using the same pattern as `dashboard_service`. No new database models or scheduled jobs. "Weekly" means ISO week period, not a cron schedule.

### Report Structure
**Weekly report** provides:
- Period metrics (sleep score, HRV, deep, REM) with prior-week comparison and trend arrows
- Bedtime consistency (reuses `_compute_consistency` from dashboard_service)
- Top positive/negative factor from full-dataset correlations (requires 14+ days overall)
- Logging completeness (DailyLog count / 7)

**Monthly report** provides:
- Period metrics with prior-month comparison
- Best and worst nights with contributing factors (human-readable DailyLog summaries)
- Stage compliance (deep/REM target hit counts, requires age setting)
- Active experiment progress (if any)
- Collapsible weekly summaries

### Insufficient Data Thresholds
- Weekly: < 2 SleepRecords → `has_insufficient_data: true`
- Monthly: < 4 SleepRecords → `has_insufficient_data: true`

### HTML Export
Server-rendered HTML with inline CSS using circadian hex values (#1a0500 background, #ff8c00 text, #ff6b6b accent). Includes print media query for PDF generation via browser's print dialog. No heavy PDF library dependency.

### SQLite Export
Raw database file download added to existing export router. Returns 409 in test environments (in-memory DB).

### Contributing Factors
The `_get_contributing_factors` helper scans a DailyLog's sub-entries to produce human-readable strings like "Exercised", "Caffeine: 200mg total", "Morning sunlight: 25 min". Only includes factors that were explicitly recorded (ADR 003 compliance).

### Trend Arrows
Relative delta between current and prior period averages. |delta| < 2% → "flat", positive → "up", negative → "down". All metrics are higher-is-better.

## Consequences
- Reports improve as users log more data (more nights, more daily log entries)
- Weekly summaries within monthly reports reuse the same `get_week_report` function
- Full-dataset top factors mean weekly reports don't show noisy within-week correlations
- HTML export is lightweight but less polished than a dedicated PDF library
- No persistence means reports are always fresh but can't be referenced historically without re-generating
