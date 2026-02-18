# ADR 007: Soft Warnings Pattern

## Status
Accepted

## Context
Daily log entries have both hard constraints (e.g., caffeine 1-600mg enforced by Pydantic) and soft advisory limits (e.g., single caffeine dose >400mg). We need a pattern that warns users about unusual values without rejecting their input.

## Decision
Write endpoints return a response wrapper containing both the data and a list of warning strings:

```python
class DailyLogResponse(BaseModel):
    data: DailyLogOut
    warnings: list[str] = []
```

- **Hard rejects**: Pydantic `Field()` constraints — request fails with 422 if violated.
- **Soft warnings**: Pure functions in `services/validation.py` — request succeeds, warnings returned alongside data.

### Soft warning thresholds
| Check | Threshold |
|-------|-----------|
| Caffeine single dose | >400mg |
| Caffeine daily total | >600mg |
| Nap duration | >120min |
| Exercise duration | >180min |
| Red light session | >30min |
| Room temperature | Outside 60-75°F |
| Alcohol units | >6 |

## Consequences
- Users are never blocked from recording truthful data.
- Frontend can display warnings as dismissible banners without blocking save.
- Validation logic is pure (no DB dependency) and trivially testable.
- Adding new soft warnings requires only updating `validation.py` — no schema or router changes needed.
