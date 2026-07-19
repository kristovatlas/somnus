"""Database setup with SQLAlchemy and configurable SQLite path."""

import contextlib
import functools
import logging
import os
import sqlite3
from collections.abc import Generator
from pathlib import Path

from alembic.config import Config as AlembicConfig
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from sqlalchemy import Column, DateTime, Engine, Inspector, create_engine, event, inspect
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from backend.config import DEFAULT_DB_DIR, settings

logger = logging.getLogger(__name__)

# The alembic scripts live at the repo root, next to the backend package.
# Valid for the editable install this project uses (ADR 014 / Makefile); a
# future non-editable distribution must package the migration scripts.
_ALEMBIC_DIR = Path(__file__).resolve().parent.parent / "alembic"


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""


@event.listens_for(Engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection: object, _connection_record: object) -> None:
    """T-09 (docs/THREAT_MODEL.md): enforce FK constraints on every connection.

    SQLite ignores declared ``ForeignKey``/cascade constraints unless
    ``PRAGMA foreign_keys=ON`` is set per-connection. Registered on the base
    ``Engine`` so it applies to the app engine and test engines alike.
    """
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def get_database_url(db_path: str | None = None) -> str:
    """Build SQLite database URL from the configured path."""
    path = db_path or str(settings.db_path)
    return f"sqlite:///{path}"


def create_db_engine(db_path: str | None = None) -> Engine:
    """Create a SQLAlchemy engine for the configured database."""

    url = get_database_url(db_path)
    return create_engine(
        url,
        connect_args={"check_same_thread": False},
        echo=False,
    )


engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency that provides a database session and ensures cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _harden_db_permissions(db_path: Path) -> None:
    """T-08 (docs/THREAT_MODEL.md): restrict the DB file (and default dir) to the owner.

    The database holds the Oura token and all health data in plaintext (T-07).
    Chmodding the file ``0600`` closes the *other-OS-user* read path on a
    shared machine (a same-user process is inside the trust domain and is out
    of scope). The parent directory is hardened to ``0700`` only when it is
    the app-managed default (``~/.somnus``): a user-supplied SOMNUS_DB_PATH —
    the T-07 encrypted-volume flow — may point into a directory other users
    or tools legitimately share (or ``.`` for a relative path), which Somnus
    must not lock down. Best-effort: silently skips ``:memory:`` and platforms
    without POSIX permission bits.
    """
    if str(db_path) == ":memory:":
        return
    if db_path.parent == DEFAULT_DB_DIR:
        with contextlib.suppress(OSError):
            os.chmod(db_path.parent, 0o700)
    # The file chmod is the load-bearing control — it must run even when the
    # directory attempt above fails or is skipped for a custom path.
    try:
        if db_path.exists():
            os.chmod(db_path, 0o600)
    except OSError:
        # Non-POSIX filesystem / platform — the OS-layer guidance in T-07
        # (full-disk / volume encryption) remains the primary control.
        pass


@functools.lru_cache(maxsize=1)
def _script_directory() -> ScriptDirectory:
    """The repo's alembic scripts — immutable per process, resolved once."""
    cfg = AlembicConfig()
    cfg.set_main_option("script_location", str(_ALEMBIC_DIR))
    return ScriptDirectory.from_config(cfg)


def _alembic_head() -> str:
    """Resolve the head revision from the migration scripts on disk."""
    head = _script_directory().get_current_head()
    if head is None:  # pragma: no cover — repo always ships migrations
        raise RuntimeError("no alembic head revision found")
    return head


def _stamp_version(revision: str) -> None:
    """Record ``revision`` as the current alembic version, on the app engine.

    Uses ``MigrationContext`` on an existing connection (it creates the
    version table itself and replaces any prior row) rather than
    ``alembic.command.stamp``, which spins up its own engine — for
    ``:memory:`` databases that would stamp a *different* database than the
    one the app holds open.
    """
    with engine.begin() as conn:
        MigrationContext.configure(conn).stamp(_script_directory(), revision)


def _schema_matches_head(connection: object) -> bool:
    """True when the live schema already equals ``Base.metadata`` (head).

    Uses alembic's own autogenerate comparison, ignoring the
    ``alembic_version`` bookkeeping table — the same check the migration
    parity test uses. This is what lets adoption stamp *head* for a
    current-but-unstamped DB without hardcoding the newest migration's
    delta as a marker (which would need hand-editing on every release).
    """
    from alembic.autogenerate import compare_metadata

    ctx = MigrationContext.configure(
        connection,  # type: ignore[arg-type]
        opts={
            "include_name": lambda name, type_, _parent: (
                not (type_ == "table" and name == "alembic_version")
            )
        },
    )
    return bool(compare_metadata(ctx, Base.metadata) == [])


def _adopt_legacy_db(inspector: Inspector, tables: set[str]) -> str:
    """Stamp an unstamped database at the revision its schema matches.

    A current-but-unstamped schema (create_all without a stamp, or a
    manually-cleared version row) is stamped at **head**, detected
    structurally via :func:`_schema_matches_head` — no per-migration marker
    to maintain.

    Older shapes fall to FROZEN pre-fix markers: ``user_settings.last_oura_sync``
    is 001's delta, the ``experiments`` table is 002's. These need no
    extension for migrations 003+ — a genuine pre-#76 unstamped DB predates
    every post-#76 migration, so its schema can only be ≤002-era; anything
    newer is caught by the head check above. The old ``create_all``-on-startup
    added missing *tables* but never *columns*, so a pre-001 DB later booted
    under 002-era code carries ``experiments`` without ``last_oura_sync`` — a
    hybrid matching no revision, repaired deterministically (001's delta) then
    stamped 002.
    """
    if "user_settings" not in tables:
        raise RuntimeError(
            f"Database at {settings.db_path} contains tables but is not a "
            "recognizable Somnus database (no user_settings, no "
            "alembic_version). Point SOMNUS_DB_PATH at a Somnus database or "
            "at a new, empty location."
        )
    with engine.connect() as conn:
        if _schema_matches_head(conn):
            head = _alembic_head()
            _stamp_version(head)
            return head
    columns = {col["name"] for col in inspector.get_columns("user_settings")}
    has_001 = "last_oura_sync" in columns
    has_002 = "experiments" in tables
    if has_002 and not has_001:
        with engine.begin() as conn:
            Operations(MigrationContext.configure(conn)).add_column(
                "user_settings", Column("last_oura_sync", DateTime(), nullable=True)
            )
        logger.warning(
            "Repaired a legacy hybrid schema: added user_settings.last_oura_sync "
            "(001's delta, skipped by the old create_all-on-startup)."
        )
        has_001 = True
    revision = "002" if has_002 else "001" if has_001 else "000_baseline"
    _stamp_version(revision)
    return revision


def _explicitly_configured() -> bool:
    """True when the DB path was pinned (env var or the saved launcher config),
    as opposed to falling back to the default ``~/.somnus/somnus.db``."""
    from backend.config import CONFIG_FILE

    return bool(os.environ.get("SOMNUS_DB_PATH")) or CONFIG_FILE.exists()


def _guard_configured_path_available(explicitly_configured: bool) -> None:
    """Refuse to start (rather than create a shadow DB) when a configured DB
    that was previously initialized has gone missing — the unmounted-encrypted-
    volume case (#41, ADR 015).

    Parent-directory presence is NOT a reliable signal: on Linux a VeraCrypt
    mount point typically persists (empty) after unmount, so keying off it
    would still create a fresh plaintext shadow DB there. Instead we key off
    the persistent "initialized" marker: if this path was pinned AND a DB was
    successfully created there before AND the file is now gone, the volume is
    unmounted / the data moved — refuse. A genuine first creation (no marker
    for this path yet) proceeds normally, as does the default path.
    """
    from backend.config import read_initialized_db_path

    path = settings.db_path
    if not explicitly_configured or str(path) == ":memory:" or path.exists():
        return
    if read_initialized_db_path() == str(path):
        raise RuntimeError(
            f"The configured Somnus database at {path} is missing — it was set "
            "up here before, so the volume is probably not mounted (or the file "
            "moved). Mount the encrypted volume and start Somnus again, or run "
            '`make db-location ARGS="--force"` to choose a new location. '
            "Refusing to create a "
            "new plaintext database in its place."
        )


def init_db() -> None:
    """Create or adopt the database on application startup.

    Fresh database (no model tables): create the full current schema and
    stamp the alembic head, so future ``make migrate`` runs start from the
    right place (issue #49). Unstamped database (pre-fix install, or an
    emptied version table): adopt it via ``_adopt_legacy_db``. A database
    behind head gets a warning, and is deliberately NOT patched with
    ``create_all``: that adds missing tables but never columns, which would
    corrupt the migration path (duplicate-table on upgrade).
    """
    # Register every model on Base.metadata before create_all: a bare
    # `python -c "from backend.database import init_db; init_db()"` (the
    # `make migrate` pre-step) imports only this module — without this,
    # a fresh DB would be stamped at head with ZERO tables created.
    import backend.models  # noqa: F401
    from backend.config import mark_db_initialized

    explicitly_configured = _explicitly_configured()
    _guard_configured_path_available(explicitly_configured)
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    inspector = inspect(engine)
    model_tables = set(inspector.get_table_names()) - {"alembic_version"}
    head = _alembic_head()

    current: str | None
    if not model_tables:
        # Covers both a brand-new DB and a stray version-table-only file:
        # create_all is exact here, and stamping head makes it consistent.
        Base.metadata.create_all(bind=engine)
        _stamp_version(head)
        current = head
    else:
        with engine.connect() as conn:
            # None when the version table is missing OR empty — both mean
            # "unstamped" and both existed in pre-fix installs.
            current = MigrationContext.configure(conn).get_current_revision()
        if current is None:
            current = _adopt_legacy_db(inspector, model_tables)

    if current != head:
        logger.warning(
            "Database schema is at revision %s but the current release "
            "expects %s — run `make migrate` to upgrade.",
            current,
            head,
        )

    _harden_db_permissions(settings.db_path)

    # Record success so a later launch can tell "first creation" from "the
    # configured DB vanished" (the guard above). Only for explicitly configured
    # non-memory paths — the default path never needs it, and unit tests that
    # don't pin a path stay out of the marker file.
    if explicitly_configured and str(settings.db_path) != ":memory:":
        mark_db_initialized(settings.db_path)
