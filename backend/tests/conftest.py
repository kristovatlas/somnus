"""Shared test fixtures for the Somnus backend test suite."""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.main import app


@pytest.fixture(name="db")
def db_session() -> Generator[Session, None, None]:
    """Provide a clean in-memory SQLite database session for each test."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    session = testing_session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(name="client")
def test_client(db: Session) -> Generator[TestClient, None, None]:
    """Provide a FastAPI TestClient with the test database injected."""

    def _override_get_db() -> Generator[Session, None, None]:
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    # Default Content-Type mirrors the SPA fetch client, which always sends
    # application/json — the non-simple trait the T-02 CSRF guard requires.
    with TestClient(
        app,
        base_url="http://localhost",
        headers={"Content-Type": "application/json"},
    ) as client:
        yield client
    app.dependency_overrides.clear()
