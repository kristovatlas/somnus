"""Database setup with SQLAlchemy and configurable SQLite path."""

import os
import sqlite3
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from backend.config import settings


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
    """T-08 (docs/THREAT_MODEL.md): restrict the DB dir/file to the owner.

    The database holds the Oura token and all health data in plaintext (T-07).
    Creating the directory ``0700`` and the file ``0600`` closes the
    *other-OS-user* read path on a shared machine (a same-user process is
    inside the trust domain and is out of scope). Best-effort: silently skips
    ``:memory:`` and platforms without POSIX permission bits.
    """
    if str(db_path) == ":memory:":
        return
    try:
        os.chmod(db_path.parent, 0o700)
        if db_path.exists():
            os.chmod(db_path, 0o600)
    except OSError:
        # Non-POSIX filesystem / platform — the OS-layer guidance in T-07
        # (full-disk / volume encryption) remains the primary control.
        pass


def init_db() -> None:
    """Create the database directory and all tables.

    Called on application startup. In production, Alembic migrations
    handle schema changes — this is a fallback for fresh installs.
    """
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    _harden_db_permissions(settings.db_path)
