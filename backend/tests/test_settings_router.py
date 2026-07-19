"""Tests for settings and red light panel HTTP endpoints."""

import datetime as dt

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.models import UserSettings

# --- User Settings ---


def test_get_settings_defaults(client: TestClient) -> None:
    resp = client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert data["oura_token_set"] is False
    assert data["caffeine_sensitivity"] == "normal"
    assert data["timezone"] == "America/New_York"
    assert data["display_mode"] == "circadian"
    assert data["onboarding_completed"] is False


def test_get_settings_does_not_persist(client: TestClient, db: Session) -> None:
    # T-02: GET must be idempotent — it must not create the settings row.
    client.get("/api/settings")
    assert db.get(UserSettings, 1) is None
    # A write (PATCH) is what actually persists the row.
    client.patch("/api/settings", json={"age": 30})
    assert db.get(UserSettings, 1) is not None


def test_patch_settings(client: TestClient) -> None:
    resp = client.patch(
        "/api/settings",
        json={"timezone": "America/Chicago", "age": 30},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["timezone"] == "America/Chicago"
    assert data["age"] == 30
    # Other fields unchanged
    assert data["caffeine_sensitivity"] == "normal"


def test_patch_settings_oura_token(client: TestClient) -> None:
    resp = client.patch("/api/settings", json={"oura_token": "secret123"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["oura_token_set"] is True
    assert "oura_token" not in data  # Token value not exposed


def test_patch_settings_partial(client: TestClient) -> None:
    """Only provided fields are updated."""
    client.patch("/api/settings", json={"age": 25})
    resp = client.patch("/api/settings", json={"timezone": "US/Pacific"})
    data = resp.json()
    assert data["age"] == 25  # Still set from earlier
    assert data["timezone"] == "US/Pacific"


def test_patch_settings_onboarding(client: TestClient) -> None:
    resp = client.patch("/api/settings", json={"onboarding_completed": True})
    assert resp.status_code == 200
    assert resp.json()["onboarding_completed"] is True


def test_last_oura_sync_includes_utc_marker(client: TestClient, db: Session) -> None:
    """last_oura_sync stored as naive UTC should be serialized with +00:00 offset."""
    settings = db.get(UserSettings, 1)
    if settings is None:
        settings = UserSettings(id=1)
        db.add(settings)
    # Store as naive UTC (as the sync endpoint does after SQLAlchemy strips tzinfo)
    settings.last_oura_sync = dt.datetime(2026, 2, 23, 15, 30, 0)
    db.commit()

    resp = client.get("/api/settings")
    data = resp.json()
    # Should include UTC offset so browsers interpret correctly
    assert data["last_oura_sync"] is not None
    assert "+00:00" in data["last_oura_sync"] or "Z" in data["last_oura_sync"]


# --- Red Light Panels ---


def test_list_panels_empty(client: TestClient) -> None:
    resp = client.get("/api/red-light-panels")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_panel(client: TestClient) -> None:
    resp = client.post(
        "/api/red-light-panels",
        json={
            "name": "Joovv Go",
            "wavelength_nm": 660,
            "irradiance_mw_cm2": 86.0,
            "default_distance_inches": 6.0,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Joovv Go"
    assert data["wavelength_nm"] == 660
    assert "id" in data


def test_get_panel(client: TestClient) -> None:
    resp = client.post("/api/red-light-panels", json={"name": "Test Panel"})
    panel_id = resp.json()["id"]
    resp = client.get(f"/api/red-light-panels/{panel_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Test Panel"


def test_get_panel_not_found(client: TestClient) -> None:
    resp = client.get("/api/red-light-panels/999")
    assert resp.status_code == 404


def test_update_panel(client: TestClient) -> None:
    resp = client.post("/api/red-light-panels", json={"name": "Old Name"})
    panel_id = resp.json()["id"]
    resp = client.put(
        f"/api/red-light-panels/{panel_id}",
        json={"name": "New Name", "wavelength_nm": 850},
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"
    assert resp.json()["wavelength_nm"] == 850


def test_update_panel_not_found(client: TestClient) -> None:
    resp = client.put("/api/red-light-panels/999", json={"name": "X"})
    assert resp.status_code == 404


def test_delete_panel(client: TestClient) -> None:
    resp = client.post("/api/red-light-panels", json={"name": "Delete Me"})
    panel_id = resp.json()["id"]
    resp = client.delete(f"/api/red-light-panels/{panel_id}")
    assert resp.status_code == 204
    resp = client.get(f"/api/red-light-panels/{panel_id}")
    assert resp.status_code == 404


def test_delete_panel_not_found(client: TestClient) -> None:
    resp = client.delete("/api/red-light-panels/999")
    assert resp.status_code == 404


def test_patch_settings_rejects_invalid_timezone(client: TestClient) -> None:
    """#50: a typo'd zone must 422, not silently persist."""
    resp = client.patch("/api/settings", json={"timezone": "America/Nueva_York"})
    assert resp.status_code == 422
    detail = str(resp.json()["detail"])
    assert "IANA timezone" in detail
    # And nothing was persisted
    resp = client.get("/api/settings")
    assert resp.json()["timezone"] != "America/Nueva_York"


def test_patch_settings_accepts_any_iana_zone(client: TestClient) -> None:
    resp = client.patch("/api/settings", json={"timezone": "Europe/Paris"})
    assert resp.status_code == 200
    assert resp.json()["timezone"] == "Europe/Paris"


def test_patch_settings_timezone_omitted_is_untouched(client: TestClient) -> None:
    client.patch("/api/settings", json={"timezone": "Asia/Tokyo"})
    resp = client.patch("/api/settings", json={"age": 40})
    assert resp.status_code == 200
    assert resp.json()["timezone"] == "Asia/Tokyo"


def test_update_panel_edits_distance(client: TestClient) -> None:
    """#60: default_distance_inches is editable via the PUT panel endpoint."""
    resp = client.post(
        "/api/red-light-panels",
        json={"name": "Panel", "irradiance_mw_cm2": 100, "default_distance_inches": 6},
    )
    panel_id = resp.json()["id"]
    resp = client.put(
        f"/api/red-light-panels/{panel_id}",
        json={"name": "Panel", "irradiance_mw_cm2": 100, "default_distance_inches": 12},
    )
    assert resp.status_code == 200
    assert resp.json()["default_distance_inches"] == 12
