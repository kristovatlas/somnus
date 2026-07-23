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

## Amendment (2026-07-23, #159): the third data state — explicit absence

### Context
The original decision recognized two states: a recorded value ("did it") and a blank/NULL ("not recorded"). That last "acceptable trade-off" above — being unable to tell "didn't do X" from "forgot to log X" — turned out to have real analytical cost. Nine binary habits (alcohol, exercise, blue blockers, screens off, sauna, warm shower, red light, NSDR, pre-bed ritual) are only ever recorded as "done" (a 1.0) or left blank (NULL). With no way to record an off-day, every one of these columns is all-1.0-or-NULL: after `dropna()` it has zero variance and the correlation engine skips it. These habits were permanently uncorrelatable, no matter how long the user logged.

### Decision
Introduce a **third data state**, so a variable can now be in exactly one of:

1. **Did it** — a recorded value/entry (e.g. a `CaffeineEntry`, a `HabitEntry` for sauna). Included in analysis at its value.
2. **Explicitly did not do it** — a recorded **absence** (`SectionAbsence` row for that date + section). This is **real negative data**: included in analysis as an explicit `0`/`False`.
3. **Not recorded** — blank/NULL, exactly as before. Unknown, **excluded** per-variable from analysis.

Explicit absence ≠ missing:
- **Missing** is *unknown* — we don't know whether it happened, so it is excluded (a blank day must never be silently read as a zero; that was the whole point of the original ADR and still holds).
- **Explicit absence** is a *known negative* the user deliberately recorded — it is a real observation and is included as `0`/`False`, giving all-or-nothing binary habits the variance they need to correlate.

### Implementation
- New additive table `section_absences (id, date → daily_logs.date, section_key)`, unique on `(date, section_key)`. `section_key` is a free string — a section id (`caffeine`, `alcohol`, `nsdr`, ...) or a namespaced per-supplement key (`supplement:<name>`, used by a later lane) — so new sections need no schema change.
- `_aggregate_daily_log` maps an absent section to its explicit zero: binary habit columns → `0.0`, continuous total/count/minutes columns → `0` (e.g. caffeine absent → `total_caffeine_mg = 0`; nap absent → `nap_total_minutes = 0`, `nap_count = 0`).
- **Clock / "last-hour" / "first-hour" columns stay NULL when absent** (`last_caffeine_hour`, `last_meal_hour`, `stimulating_last_hour`, `sunlight_first_hour`): there is no clock time for an event that did not happen, and forcing `0` would corrupt the evening-clock analysis.
- Real entries win: if a day somehow carries both entries and an absence for the same section, the entries stand and the absence is ignored.

### Consequences
- **Purely additive.** Existing daily logs have no `section_absences` rows, so their blanks keep their exact "not recorded"/unknown meaning — nothing about historical data or the missing-data guarantee changes. This is why it is not a "beyond additive-nullable" migration and carries no separate data escalation.
- The 8 binary habits (and per-supplement predictors, a later lane) become correlatable **once the user records off-days** — the unlock is opt-in per variable, not retroactive.
- A blank day is still never treated as a zero. The only thing that produces a `0`/`False` is an explicit `SectionAbsence`.
