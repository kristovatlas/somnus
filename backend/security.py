"""Shared request-security dependencies (docs/THREAT_MODEL.md)."""

from __future__ import annotations

from fastapi import HTTPException, Request


def require_json_content_type(request: Request) -> None:
    """Require ``Content-Type: application/json`` on a state-changing request (T-02).

    ``application/json`` is **not** a CORS "simple" content type, so a cross-site
    caller can only set it by triggering a preflight — which the pinned CORS
    origin fails. Applied to state-changers that take **no JSON body** (e.g. the
    bodiless ``copy-from`` POST and the Oura sync POST); without it those are
    CORS-simple requests a hostile page can send without a preflight (the
    reproduced T-02 CSRF vector). Endpoints that already require a JSON body are
    covered by FastAPI's own body parsing (non-JSON → 422). The SPA's fetch
    client always sends this header, so legitimate calls are unaffected.
    """
    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if content_type != "application/json":
        raise HTTPException(
            status_code=415,
            detail="Content-Type must be application/json",
        )
