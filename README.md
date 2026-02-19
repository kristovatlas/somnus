# Somnus

A locally-run sleep optimization app that combines Oura Ring wearable data with manual habit tracking and statistical analysis to identify what actually affects *your* sleep.

All data stays on your machine. No cloud accounts, no telemetry.

## What it does

- **Track habits** — caffeine, supplements, exercise, alcohol, blue blockers, naps, red light therapy, NSDR, meal timing, and more
- **Import sleep data** — syncs with the Oura Ring via personal access token
- **Analyze** — after 14+ days: pairwise correlations. After 50+ days: multivariate regression, chronotype inference, optimal bedtime window
- **Recommend** — personalized, science-backed suggestions with 2-week experiment tracking
- **Report** — weekly and monthly summaries with trend arrows, best/worst nights, stage compliance, and HTML export

## Requirements

- Python 3.11+
- Node.js 18+

## Quick start

```bash
git clone <repo>
cd somnus
make setup    # Install Python + Node dependencies
make dev      # Backend on :8000, frontend on :5173
```

Open http://localhost:5173 in your browser. The onboarding wizard walks you through initial setup.

## Make targets

| Command | What it does |
|---------|-------------|
| `make setup` | Install all dependencies (pip + npm) |
| `make dev` | Run backend + frontend in dev mode |
| `make test` | Run all tests (pytest + vitest) |
| `make lint` | Run all linters (ruff, mypy, eslint) |
| `make format` | Auto-format Python + TypeScript |
| `make migrate` | Apply pending DB migrations (Alembic) |
| `make audit` | Run pip-audit + npm audit |
| `make clean` | Remove caches and build artifacts |

## Stack

- **Backend**: Python, FastAPI, SQLAlchemy, SQLite, scipy, statsmodels
- **Frontend**: React 19, TypeScript, Vite, React Router
- **Testing**: pytest (backend), Vitest + React Testing Library (frontend)
- **Database**: SQLite — single file, default `~/.somnus/somnus.db` (configurable)

## Project structure

```
backend/
  main.py              # FastAPI app
  models.py            # SQLAlchemy ORM models
  schemas.py           # Pydantic request/response schemas
  config.py            # Settings (DB path, CORS)
  routers/             # API endpoints
  services/            # Business logic (stats, reports, recommendations)
  science/             # Evidence-based reference data
  tests/               # pytest suite (95% coverage)

frontend/src/
  components/          # React components (DailyLog, Dashboard, Analysis, Reports, etc.)
  hooks/               # Custom React hooks
  api/                 # API client functions
  types/               # TypeScript interfaces

docs/adr/              # Architecture Decision Records
ARCHITECTURE.md        # C4 diagrams (Mermaid)
PLAN.md                # Full feature specification
```

## Display mode

Somnus defaults to a **circadian display mode** — an amber/red color palette that avoids melanopsin-triggering wavelengths (no blue, green, or white). A sleep app shouldn't blast blue light at you at 10 PM.

## Data philosophy

- **Missing data is not negative data.** An empty field means "not recorded," never "didn't happen." See [ADR 003](docs/adr/003-missing-data-semantics.md).
- **Correlation is not causation.** All analysis uses hedged language ("associated with," never "causes"). See [ADR 005](docs/adr/005-correlation-not-causation.md).
- **Your data is yours.** Export anytime as CSV, JSON, or raw SQLite.

## License

Private — not yet licensed for distribution.
