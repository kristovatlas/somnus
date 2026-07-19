# ADR 001: Use SQLite as the Database

## Status
Accepted

## Context
Somnus is a locally-run, single-user application that stores sensitive health data (sleep metrics, habits, supplement usage, sexual activity). We need a database that:
- Requires zero configuration for end users
- Stores data locally with no cloud dependency
- Supports a user-configurable file path (e.g., VeraCrypt containers)
- Handles the volume of a single user's daily entries (low write throughput)
- Is portable across macOS, Linux, and Windows

Options considered:
- **SQLite**: File-based, zero-config, embedded, widely supported
- **PostgreSQL**: Full-featured RDBMS, but requires installation and a running server process
- **JSON files**: Simple, but no query capability, no ACID guarantees, poor for relational data
- **DuckDB**: Analytical focus, good for time series, but less mature ORM support

## Decision
Use SQLite as the sole database, accessed through SQLAlchemy ORM with Alembic for migrations.

The database file path is user-configurable via `SOMNUS_DB_PATH` environment variable or in-app settings, defaulting to `~/.somnus/somnus.db`.

## Consequences
**Positive:**
- Zero installation burden — SQLite is bundled with Python
- Single-file database — trivial backup (copy one file), easy to move between machines
- User can store the file in an encrypted volume for privacy
- Fast enough for our workload (single user, <1000 rows/day)
- Excellent tooling — can inspect data with any SQLite browser

**Negative:**
- No concurrent write access — not an issue for single-user, but rules out multi-device sync
- Limited built-in date/time functions compared to PostgreSQL — handled in Python
- No native JSON column type — use TEXT with JSON serialization where needed
- If we ever need multi-user or cloud sync, we'd need to migrate
