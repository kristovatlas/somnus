# ADR 010: Analysis Engine Architecture

## Status
Accepted

## Context
Somnus needs a statistical analysis engine to turn raw sleep + habit data into actionable insights. Key design decisions include how to structure the data pipeline, which statistical methods to use, how to handle the small-dataset reality of a local app, and how to communicate results without implying causation.

## Decision

### Central DataFrame Pattern
All analysis operates on a single flat DataFrame built by `prepare_analysis_dataframe(db)`. This function:
1. Queries all SleepRecords (outcomes) and DailyLogs (predictors)
2. Aggregates sub-entries per date into numeric features
3. Left-joins on date, preserving NaN for missing values (per ADR 003)
4. Computes derived columns (bedtime_hour, sleep_midpoint, rolling consistency)

This avoids repeated DB queries across analysis functions and ensures consistent NaN handling.

### Four Independent Regression Models
Separate OLS models for sleep_score, deep_minutes, rem_minutes, and avg_hrv. Different outcomes often have different predictors (e.g., alcohol affects REM more than deep sleep). Each model includes:
- Lag-1 autoregressive term for the outcome
- Standardized coefficients for comparability
- VIF multicollinearity detection (threshold > 5.0)
- ADF stationarity test on residuals
- ACF autocorrelation check

### Phase-Gated UI
Analysis features unlock progressively based on data sufficiency:
- **Phase A** (≥14 days): Pairwise correlations
- **Phase B** (≥50 days): OLS regression models
- **Phase C** (≥30 bedtimes): Chronotype, social jet lag, optimal bedtime

This prevents showing unreliable results from tiny samples and gives users clear milestones.

### Per-Variable NaN Handling
Each correlation/regression pair uses `.dropna(subset=[predictor, outcome])`. Different variables have different effective sample sizes. A user who tracks caffeine for 60 days but only exercise for 10 days gets caffeine analysis but not exercise analysis, rather than losing all analysis.

### No Caching
The dataset is small (local app, hundreds of rows). Full DataFrame construction + OLS fit completes in <100ms. Caching would add invalidation complexity not justified at this scale.

### Correlation ≠ Causation Guardrails
All user-facing text uses hedged language: "associated with," "correlated with," "your data suggests." Never "causes," "improves," or "leads to." Sample size is shown on every insight. A persistent "How to read these results" explainer is accessible from the analysis page.

### Deferred: Seasonal Covariates
The regression engine accepts optional covariates, but seasonal variables (daylight_hours, season, DST) require Open-Meteo API integration that doesn't exist yet. These are deferred until that service is built.

## Consequences

### Positive
- Central DataFrame makes all analysis functions testable with synthetic data
- Phase gating prevents misleading results from small samples
- Per-variable NaN handling maximizes data utilization
- Hedged language reduces risk of users drawing causal conclusions

### Negative
- No caching means repeated full computation on each page load (acceptable at current scale)
- Standardized coefficients are harder to interpret than raw units (mitigated by clear labeling)
- Phase thresholds (14/50/30) are somewhat arbitrary (based on statistical rules of thumb)

### Risks
- Users may still interpret correlations causally despite language guardrails
- OLS assumptions (linearity, normality) may not hold for all predictor-outcome pairs
- Small sample sizes inherent to personal tracking limit statistical power
