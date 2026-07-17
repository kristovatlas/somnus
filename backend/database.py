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


def _adopt_legacy_db(inspector: Inspector, tables: set[str]) -> str:
    """Stamp a pre-#49 unstamped database at the revision its schema matches.

    The legacy shapes are FROZEN: every database this code touches gets
    stamped, so unstamped schemas can only come from pre-fix installs whose
    models stopped at 002. Do NOT extend the marker set for migrations
    003+ — their deltas can only ever appear in already-stamped databases.

    Markers: ``user_settings.last_oura_sync`` is 001's delta; the
    ``experiments`` table is 002's. The old ``create_all``-on-startup added
    missing *tables* but never *columns*, so a pre-001 database later booted
    under 002-era code carries ``experiments`` without ``last_oura_sync`` —
    a hybrid that matches no revision and that no stamp can repair. Its
    repair is deterministic (it is exactly 001's delta): add the column,
    after which the schema genuinely is 002.
    """
    if "user_settings" not in tables:
        raise RuntimeError(
            f"Database at {settings.db_path} contains tables but is not a "
            "recognizable Somnus database (no user_settings, no "
            "alembic_version). Point SOMNUS_DB_PATH at a Somnus database or "
            "at a new, empty location."
        )
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
