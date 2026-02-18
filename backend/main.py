"""Somnus — Sleep Optimization App. FastAPI application entry point."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.database import init_db
from backend.routers import daily_log, dashboard, export, oura
from backend.routers import settings as settings_router
from backend.schemas import HealthResponse

VERSION = "0.1.0"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup and shutdown lifecycle."""
    init_db()
    yield


app = FastAPI(
    title="Somnus",
    description="Sleep optimization API — track habits, import Oura data, analyze what works",
    version=VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(daily_log.router)
app.include_router(settings_router.router)
app.include_router(export.router)
app.include_router(oura.router)
app.include_router(dashboard.router)


@app.get("/api/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(status="ok", version=VERSION)
