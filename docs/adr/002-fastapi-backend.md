# ADR 002: Use FastAPI for the Backend

## Status
Accepted

## Context
Somnus needs a Python backend to serve a REST API, run statistical analysis (scipy, statsmodels), and integrate with external APIs (Oura, Open-Meteo). The backend framework must:
- Support async HTTP for external API calls (Oura sync, weather data)
- Provide automatic request/response validation
- Integrate well with SQLAlchemy and Pydantic
- Be lightweight for a local application
- Support good testing patterns

Options considered:
- **FastAPI**: Modern, async-native, Pydantic-first, auto-generated OpenAPI docs
- **Django + DRF**: Full-featured, but heavy for a local single-user app. ORM is Django-specific.
- **Flask**: Lightweight, but no built-in validation, no async, more boilerplate
- **Litestar**: Similar to FastAPI but smaller community and ecosystem

## Decision
Use FastAPI with Uvicorn as the ASGI server. Use Pydantic v2 for all request/response schemas. Use httpx for async external API calls.

## Consequences
**Positive:**
- Pydantic schemas enforce validation at API boundaries — no unvalidated data reaches the DB
- Async support for non-blocking Oura/weather API calls during sync
- Auto-generated OpenAPI docs at `/docs` — useful during development
- Excellent testing support via `TestClient` (synchronous) and `httpx.AsyncClient`
- Type hints throughout — works well with mypy strict mode
- Lightweight — fast startup, low memory for a local app

**Negative:**
- No built-in ORM (we use SQLAlchemy separately, which is fine)
- Smaller ecosystem than Django for admin panels, auth, etc. (not needed for this app)
- Async can add complexity — but we only use it for external API calls, not DB access
