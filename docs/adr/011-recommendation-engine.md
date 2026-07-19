# ADR 011: Recommendation Engine Architecture

## Status
Accepted

## Context
With the analysis engine (ADR 010) producing regression results and correlations, users need actionable next steps. Raw statistical output is difficult to interpret. A recommendation layer bridges the gap between data analysis and concrete behavior changes.

Key considerations:
- Recommendations must use hedged language (ADR 005) — statistical associations, not causal claims
- Users should be able to deliberately test one factor at a time (experiment tracking)
- Recommendations should combine the user's personal data patterns with evidence-based sleep science thresholds
- The system should suggest tracking factors the user hasn't tried yet

## Decision

### Four Recommendation Generators
The engine runs four independent generators, then merges, deduplicates, and priority-sorts the results:

1. **Data-Driven** — For each primary outcome, reads regression coefficients. Significant predictors (p < 0.05, excluding lag-1 terms) produce recommendations using pre-written hedged action text from `PREDICTOR_ACTIONS`. This ensures no dynamically generated causal language.

2. **Science Threshold** — Compares the user's last-14-day averages against known research thresholds (e.g., caffeine after 2 PM, room temp outside 65-68°F). Only fires when the user has ≥7 recent non-null days for that factor.

3. **Untried** — For factors with <7 recorded days that have an associated `untried_suggestion`, emits a lower-priority recommendation encouraging the user to try tracking it.

4. **Timing** — From sleep timing analysis: social jet lag > 60 minutes, or recent bedtime later than the personal optimal window by 30+ minutes.

### Priority Scoring
```
base = {data_driven: 10, timing: 15, science_threshold: 20, untried: 30}
evidence_adj = {very_high: -5, high: -3, moderate: 0, low: 3}
coef_adj = min(int(-abs(coefficient) * 5), -3)  # data_driven only
priority = max(1, base + evidence_adj + coef_adj)
```
Lower number = higher priority. Capped at 20 total recommendations.

### Experiment Tracking
- Experiments are persisted in the database (2-week default duration)
- Only one active experiment at a time (prevents confounded attribution)
- Baseline metrics: mean of 14 days before `start_date`
- Result metrics: mean from `start_date` to `min(end_date, today)`
- Auto-complete: experiments past their `end_date` are lazily set to `completed`
- All metrics computed at read time (not stored) to avoid staleness

### Gated on Phase B
Recommendations require 50+ days of data (same gate as regression). Below that threshold, the page shows a day count and encouragement message.

### Static Action Text
All user-facing recommendation text comes from two static dictionaries:
- `PREDICTOR_ACTIONS`: direction-keyed hedged action text per predictor
- `SCIENCE_THRESHOLDS[].body_template`: parameterized templates with `{avg}`, `{threshold}`, `{n_days}` placeholders

This prevents any possibility of dynamically generating causal or unhedged language.

## Consequences
- Recommendations improve as the user logs more data (more regression significance)
- The experiment feature encourages scientific thinking about sleep optimization
- Untried suggestions help users discover tracking features they haven't explored
- Priority scoring may need tuning based on user feedback
- The single-active-experiment constraint keeps attribution clean but may frustrate users who want to test multiple changes simultaneously
