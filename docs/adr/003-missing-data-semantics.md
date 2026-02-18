# ADR 003: Missing Data Means "Not Recorded," Never "Didn't Happen"

## Status
Accepted

## Context
Somnus tracks many daily variables (caffeine, supplements, exercise, meals, etc.) alongside Oura sleep data. Users will frequently have days where:
- They import historical Oura data but don't backfill habit entries
- They log some habits but not others on a given day
- They skip logging entirely for a day or two

The statistical analysis engine needs to know how to interpret missing values. There are two options:
1. **Missing = zero/false**: Treat no caffeine entry as "0 mg caffeine consumed"
2. **Missing = NULL/unknown**: Treat no caffeine entry as "we don't know what happened"

Option 1 is simpler but fundamentally dishonest — it would mean importing 6 months of Oura data creates 6 months of fake "zero caffeine, zero exercise, no supplements" records, contaminating every analysis.

## Decision
All missing data is treated as NULL (unknown), never as zero or false.

Specifically:
- Every field in every entry type is optional in the Pydantic schema (except `date`)
- The database stores NULL for unrecorded fields
- The analysis engine **excludes** NULL values per-variable: correlation between caffeine and sleep score uses only days where caffeine was explicitly recorded
- Different variables may have different effective sample sizes
- The UI displays "based on N days of data" for every insight
- Minimum thresholds: 14 recorded days for correlations, 30 for regression per variable

## Consequences
**Positive:**
- Historical Oura import is painless — no pressure to backfill
- Users can log partially without corrupting analysis
- Data entry never feels like a chore — skip anything you want
- Analysis results are honest about what they're based on
- Prevents the most common statistical error in self-tracking apps

**Negative:**
- Analysis for rarely-logged variables will be slow to unlock (need enough explicit entries)
- More complex query logic — every aggregation must handle NULLs
- Users may not realize that unlogged days don't count toward analysis (mitigated by "N days" display)
- Cannot distinguish "user didn't do X" from "user forgot to log X" (acceptable trade-off)
