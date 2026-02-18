"""Database setup with SQLAlchemy and configurable SQLite path."""

from collections.abc import Generator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from backend.config import settings


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""


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


def init_db() -> None:
    """Create the database directory and all tables.

    Called on application startup. In production, Alembic migrations
    handle schema changes — this is a fallback for fresh installs.
    """
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
