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

- Python 3.11+ (with `pip`; `make setup` installs a pinned [uv](https://github.com/astral-sh/uv) for the actual dependency install)
- Node.js **20.19+ (or 22.12+)** with **npm ≥ 11.10** — the frontend enforces both (`engine-strict`; vite requires the Node floor, and older npm silently ignores the supply-chain cooldown below, so the install hard-fails instead of degrading). Upgrade npm with the same pinned version CI uses:

  ```bash
  npm install -g npm@11.18.0
  ```

## Quick start

```bash
git clone <repo>
cd somnus
make setup    # Install Python + Node dependencies
make dev      # Backend on :8000, frontend on :5173
```

Open http://localhost:5173 in your browser. The onboarding wizard walks you through initial setup. A fresh install needs no migration step — the first backend start creates the database schema and stamps it for future upgrades.

**Note on dependency installs:** Somnus enforces a **7-day minimum release age** on dependencies (supply-chain protection — see [ADR 014](docs/adr/014-dependency-cooldown.md)). The vetting happens when the committed lockfiles are *updated* — `make setup` itself resolves nothing; it installs exactly the locked, hash-verified versions. If a security fix younger than 7 days must come in, the backend override is a committed per-package `exclude-newer-package` entry in `pyproject.toml` followed by `uv lock` (frontend: `npm install --before`) — see ADR 014 §4 for the exact steps.

## Make targets

| Command | What it does |
|---------|-------------|
| `make setup` | Install all dependencies (pip + npm) |
| `make dev` | Apply pending DB migrations, then run backend + frontend in dev mode |
| `make test` | Run all tests (pytest + vitest) |
| `make lint` | Run all linters (ruff, mypy, eslint) |
| `make format` | Auto-format Python + TypeScript |
| `make migrate` | Apply pending DB migrations (Alembic) — needed after upgrading Somnus, not on a fresh install |
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

## Encryption at rest — protect your database

The SQLite database holds your Oura API token and every health entry — sleep, and sensitive categories like alcohol, illness, and sexual activity — **as plain text; Somnus does not encrypt the file itself** (see threat [T-07](docs/THREAT_MODEL.md)). Anyone who can read `somnus.db` can read all of it: a lost or stolen device without disk encryption, or another user account on a shared machine.

- **Baseline: turn on full-disk encryption** — FileVault (macOS), BitLocker (Windows), or LUKS/dm-crypt (Linux). This protects the file if the device is lost or stolen.
- **Extra layer: keep the database on an encrypted volume** such as [VeraCrypt](https://github.com/veracrypt/VeraCrypt) (the project's official repo, with signed releases and download links). On first run, `make setup`/`make dev` **prompt for the database location** (with tab-completion) — mount your encrypted volume first, then enter a path on it, and no database is created anywhere until you choose. You can also set it non-interactively with `SOMNUS_DB_PATH=/your/encrypted/path/somnus.db` or `make db-location ARGS="--path /your/encrypted/path/somnus.db"` (for headless setups); the choice is saved for later launches.

The onboarding wizard surfaces this same guidance before the Oura step.

## License

Private — not yet licensed for distribution.

<!-- ruleset enforcement test — delete me -->
