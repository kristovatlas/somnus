"""Test-only endpoints for E2E testing. Only registered when SOMNUS_TESTING=1."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import Base, engine, get_db

router = APIRouter(prefix="/api/test", tags=["testing"])


@router.post("/reset")
def reset_database(db: Session = Depends(get_db)) -> dict[str, str]:
    """Drop and recreate all tables. For E2E test isolation only."""
    db.close()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return {"status": "ok"}
