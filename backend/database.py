"""Database setup with SQLAlchemy and configurable SQLite path."""

import contextlib
import logging
import os
import sqlite3
from collections.abc import Generator
from pathlib import Path

from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory
from sqlalchemy import Engine, create_engine, event, inspect, text
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


def _alembic_head() -> str:
    """Resolve the head revision from the migration scripts on disk."""
    cfg = AlembicConfig()
    cfg.set_main_option("script_location", str(_ALEMBIC_DIR))
    head = ScriptDirectory.from_config(cfg).get_current_head()
    if head is None:  # pragma: no cover — repo always ships migrations
        raise RuntimeError("no alembic head revision found")
    return head


def _stamp_version(revision: str) -> None:
    """Record ``revision`` as the current alembic version, on the app engine.

    Writes the version table directly (same DDL alembic uses) instead of
    invoking ``alembic.command.stamp``: the command spins up its own engine,
    which for ``:memory:`` databases would stamp a *different* database than
    the one the app holds open.
    """
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS alembic_version ("
                "version_num VARCHAR(32) NOT NULL, "
                "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
            )
        )
        conn.execute(text("DELETE FROM alembic_version"))
        conn.execute(
            text("INSERT INTO alembic_version (version_num) VALUES (:rev)"),
            {"rev": revision},
        )


def _detect_unstamped_revision(tables: set[str], columns: set[str]) -> str:
    """Infer which revision an unstamped database's schema corresponds to.

    Pre-fix installs created their schema with ``create_all`` and were never
    stamped (issue #49). The two migration deltas are the markers: the
    ``experiments`` table (002) and ``user_settings.last_oura_sync`` (001).
    """
    if "experiments" in tables:
        return _alembic_head()
    if "last_oura_sync" in columns:
        return "001"
    return "000_baseline"


def init_db() -> None:
    """Create or adopt the database on application startup.

    Fresh database: create the full current schema and stamp the alembic
    head, so future ``make migrate`` runs start from the right place
    (issue #49). Existing unstamped database (created by a pre-fix install):
    stamp the revision its schema corresponds to — head for a current
    schema, an earlier revision otherwise, in which case ``make migrate``
    completes the upgrade. Databases behind head are deliberately NOT
    patched with ``create_all``: it adds missing tables but never columns,
    which would corrupt the migration path (duplicate-table on upgrade).
    """
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    head = _alembic_head()

    if not tables:
        Base.metadata.create_all(bind=engine)
        _stamp_version(head)
    elif "alembic_version" not in tables:
        columns = {col["name"] for col in inspector.get_columns("user_settings")}
        revision = _detect_unstamped_revision(tables, columns)
        _stamp_version(revision)
        if revision != head:
            logger.warning(
                "Database schema is at revision %s but the current release "
                "expects %s — run `make migrate` to upgrade.",
                revision,
                head,
            )
    else:
        with engine.connect() as conn:
            row = conn.execute(text("SELECT version_num FROM alembic_version")).first()
        current = row[0] if row else None
        if current != head:
            logger.warning(
                "Database schema is at revision %s but the current release "
                "expects %s — run `make migrate` to upgrade.",
                current,
                head,
            )

    _harden_db_permissions(settings.db_path)
