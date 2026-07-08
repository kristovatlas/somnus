"""Tests for daily log HTTP endpoints."""

from fastapi.testclient import TestClient

# The SPA's fetch client always sends this header; the T-02 CSRF guard on the
# bodiless copy-from POST requires it (requests with a JSON body get it from
# the client's `json=` parameter automatically).
JSON_HEADERS = {"Content-Type": "application/json"}

# --- PUT (upsert) ---


def test_put_creates_log(client: TestClient) -> None:
    resp = client.put(
        "/api/daily-log/2025-06-15",
        json={
            "is_sick": False,
            "notes": "Felt great",
            "caffeine_entries": [
                {"amount_mg": 95, "source": "drip_coffee"},
            ],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["date"] == "2025-06-15"
    assert body["data"]["notes"] == "Felt great"
    assert len(body["data"]["caffeine_entries"]) == 1
    assert body["warnings"] == []


def test_put_upserts_replaces(client: TestClient) -> None:
    client.put(
        "/api/daily-log/2025-06-15",
        json={"caffeine_entries": [{"amount_mg": 95, "source": "other"}]},
    )
    resp = client.put(
        "/api/daily-log/2025-06-15",
        json={"caffeine_entries": [{"amount_mg": 200, "source": "cold_brew"}]},
    )
    assert resp.status_code == 200
    entries = resp.json()["data"]["caffeine_entries"]
    assert len(entries) == 1
    assert entries[0]["amount_mg"] == 200


def test_put_returns_warnings(client: TestClient) -> None:
    resp = client.put(
        "/api/daily-log/2025-06-15",
        json={"caffeine_entries": [{"amount_mg": 500, "source": "other"}]},
    )
    assert resp.status_code == 200
    assert len(resp.json()["warnings"]) > 0


def test_put_empty_log(client: TestClient) -> None:
    resp = client.put("/api/daily-log/2025-06-15", json={})
    assert resp.status_code == 200
    assert resp.json()["data"]["date"] == "2025-06-15"


def test_put_with_all_entry_types(client: TestClient) -> None:
    resp = client.put(
        "/api/daily-log/2025-06-15",
        json={
            "is_sick": False,
            "caffeine_entries": [{"amount_mg": 95, "source": "espresso"}],
            "meal_entries": [{"notes": "dinner"}],
            "supplement_entries": [{"name": "magnesium", "dose_mg": 144}],
            "habit_entries": [{"habit_type": "exercise", "duration_minutes": 45}],
            "stimulating_activity_entries": [{"activity_type": "video_games"}],
            "sexual_activity_entry": {"activity_type": "partnered"},
            "pre_bed_ritual_entries": [{"ritual_type": "deep_breathing", "duration_minutes": 10}],
            "nap_entries": [{"duration_minutes": 20}],
            "sunlight_entries": [{"duration_minutes": 15}],
            "red_light_entries": [{"duration_minutes": 10}],
            "nsdr_entries": [{"duration_minutes": 15, "nsdr_type": "yoga_nidra"}],
        },
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data["caffeine_entries"]) == 1
    assert len(data["meal_entries"]) == 1
    assert len(data["supplement_entries"]) == 1
    assert len(data["habit_entries"]) == 1
    assert len(data["stimulating_activity_entries"]) == 1
    assert data["sexual_activity_entry"] is not None
    assert len(data["pre_bed_ritual_entries"]) == 1
    assert len(data["nap_entries"]) == 1
    assert len(data["sunlight_entries"]) == 1
    assert len(data["red_light_entries"]) == 1
    assert len(data["nsdr_entries"]) == 1


# --- GET single ---


def test_get_existing_log(client: TestClient) -> None:
    client.put("/api/daily-log/2025-06-15", json={"notes": "test"})
    resp = client.get("/api/daily-log/2025-06-15")
    assert resp.status_code == 200
    assert resp.json()["notes"] == "test"


def test_get_nonexistent_log(client: TestClient) -> None:
    resp = client.get("/api/daily-log/2025-06-15")
    assert resp.status_code == 404


# --- DELETE ---


def test_delete_existing_log(client: TestClient) -> None:
    client.put("/api/daily-log/2025-06-15", json={})
    resp = client.delete("/api/daily-log/2025-06-15")
    assert resp.status_code == 204
    # Verify it's gone
    resp = client.get("/api/daily-log/2025-06-15")
    assert resp.status_code == 404


def test_delete_nonexistent_log(client: TestClient) -> None:
    resp = client.delete("/api/daily-log/2025-06-15")
    assert resp.status_code == 404


# --- GET list ---


def test_list_logs_empty(client: TestClient) -> None:
    resp = client.get("/api/daily-log")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_logs(client: TestClient) -> None:
    client.put("/api/daily-log/2025-06-15", json={})
    client.put("/api/daily-log/2025-06-16", json={"is_sick": True})
    resp = client.get("/api/daily-log")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["date"] == "2025-06-15"
    assert data[1]["date"] == "2025-06-16"
    assert data[1]["is_sick"] is True


def test_list_logs_with_date_range(client: TestClient) -> None:
    client.put("/api/daily-log/2025-06-15", json={})
    client.put("/api/daily-log/2025-06-16", json={})
    client.put("/api/daily-log/2025-06-17", json={})
    resp = client.get("/api/daily-log?start_date=2025-06-16&end_date=2025-06-16")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["date"] == "2025-06-16"


def test_list_logs_has_entries_flag(client: TestClient) -> None:
    client.put(
        "/api/daily-log/2025-06-15",
        json={"caffeine_entries": [{"amount_mg": 95, "source": "other"}]},
    )
    client.put("/api/daily-log/2025-06-16", json={})
    resp = client.get("/api/daily-log")
    data = resp.json()
    assert data[0]["has_entries"] is True
    assert data[1]["has_entries"] is False


# --- Copy day ---


def test_copy_day(client: TestClient) -> None:
    client.put(
        "/api/daily-log/2025-06-15",
        json={
            "is_sick": True,
            "notes": "Source notes",
            "caffeine_entries": [{"amount_mg": 95, "source": "espresso"}],
        },
    )
    resp = client.post("/api/daily-log/2025-06-16/copy-from/2025-06-15", headers=JSON_HEADERS)
    assert resp.status_code == 200
    data = resp.json()
    assert data["date"] == "2025-06-16"
    assert data["copied_from_date"] == "2025-06-15"
    assert data["is_sick"] is True
    assert data["notes"] is None  # Notes NOT copied
    assert len(data["caffeine_entries"]) == 1


def test_copy_day_source_not_found(client: TestClient) -> None:
    resp = client.post("/api/daily-log/2025-06-16/copy-from/2025-06-15", headers=JSON_HEADERS)
    assert resp.status_code == 404


def test_copy_day_rejects_non_json_content_type(client: TestClient) -> None:
    # T-02: a CORS-simple (non-JSON) cross-site POST must be rejected so the
    # bodiless copy-from can't be driven by a hostile form submission.
    client.put("/api/daily-log/2025-06-15", json={"is_sick": True})
    resp = client.post(
        "/api/daily-log/2025-06-16/copy-from/2025-06-15",
        headers={"Content-Type": "text/plain"},
    )
    assert resp.status_code == 415
    # The target day must not have been created
    assert client.get("/api/daily-log/2025-06-16").status_code == 404


def test_copy_day_rejects_absent_content_type(client: TestClient) -> None:
    # T-02: a bodiless POST with *no* Content-Type at all is also CORS-simple —
    # the guard must 415 it before the destructive overwrite runs.
    client.put("/api/daily-log/2025-06-15", json={"is_sick": True})
    resp = client.post("/api/daily-log/2025-06-16/copy-from/2025-06-15")
    assert resp.status_code == 415
    assert client.get("/api/daily-log/2025-06-16").status_code == 404


# --- Sub-entry routes (testing a few representative types) ---


def test_add_caffeine_entry(client: TestClient) -> None:
    resp = client.post(
        "/api/daily-log/2025-06-15/caffeine",
        json={"amount_mg": 95, "source": "drip_coffee"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["amount_mg"] == 95
    assert data["date"] == "2025-06-15"
    assert "id" in data


def test_add_entry_creates_log(client: TestClient) -> None:
    """Adding a sub-entry should auto-create the DailyLog if needed."""
    resp = client.post(
        "/api/daily-log/2025-06-15/naps",
        json={"duration_minutes": 20},
    )
    assert resp.status_code == 201
    # Log should now exist
    resp = client.get("/api/daily-log/2025-06-15")
    assert resp.status_code == 200


def test_update_caffeine_entry(client: TestClient) -> None:
    resp = client.post(
        "/api/daily-log/2025-06-15/caffeine",
        json={"amount_mg": 95, "source": "other"},
    )
    entry_id = resp.json()["id"]
    resp = client.put(
        f"/api/daily-log/2025-06-15/caffeine/{entry_id}",
        json={"amount_mg": 200, "source": "espresso"},
    )
    assert resp.status_code == 200
    assert resp.json()["amount_mg"] == 200


def test_update_entry_not_found(client: TestClient) -> None:
    resp = client.put(
        "/api/daily-log/2025-06-15/caffeine/999",
        json={"amount_mg": 200, "source": "other"},
    )
    assert resp.status_code == 404


def test_update_entry_invalid_data_422(client: TestClient) -> None:
    # T-05: invalid body on the update path must be 422, not an unhandled 500
    resp = client.post(
        "/api/daily-log/2025-06-15/caffeine",
        json={"amount_mg": 95, "source": "other"},
    )
    entry_id = resp.json()["id"]
    resp = client.put(
        f"/api/daily-log/2025-06-15/caffeine/{entry_id}",
        json={"amount_mg": 0},  # below minimum
    )
    assert resp.status_code == 422


def test_delete_caffeine_entry(client: TestClient) -> None:
    resp = client.post(
        "/api/daily-log/2025-06-15/caffeine",
        json={"amount_mg": 95, "source": "other"},
    )
    entry_id = resp.json()["id"]
    resp = client.delete(f"/api/daily-log/2025-06-15/caffeine/{entry_id}")
    assert resp.status_code == 204


def test_delete_entry_not_found(client: TestClient) -> None:
    resp = client.delete("/api/daily-log/2025-06-15/caffeine/999")
    assert resp.status_code == 404


def test_add_habit_entry(client: TestClient) -> None:
    resp = client.post(
        "/api/daily-log/2025-06-15/habits",
        json={"habit_type": "exercise", "duration_minutes": 45},
    )
    assert resp.status_code == 201
    assert resp.json()["habit_type"] == "exercise"


def test_add_nap_entry(client: TestClient) -> None:
    resp = client.post(
        "/api/daily-log/2025-06-15/naps",
        json={"duration_minutes": 20, "start_time": "13:00:00"},
    )
    assert resp.status_code == 201
    assert resp.json()["duration_minutes"] == 20


def test_add_nsdr_entry(client: TestClient) -> None:
    resp = client.post(
        "/api/daily-log/2025-06-15/nsdr",
        json={"duration_minutes": 15, "nsdr_type": "yoga_nidra"},
    )
    assert resp.status_code == 201
    assert resp.json()["nsdr_type"] == "yoga_nidra"


def test_invalid_entry_data(client: TestClient) -> None:
    resp = client.post(
        "/api/daily-log/2025-06-15/caffeine",
        json={"amount_mg": 0},  # Below minimum
    )
    assert resp.status_code == 422
