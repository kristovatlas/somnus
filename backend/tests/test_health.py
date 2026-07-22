"""Tests for the health check endpoint."""

from fastapi.testclient import TestClient


def test_health_check(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data


def test_health_check_returns_version(client: TestClient) -> None:
    response = client.get("/api/health")
    data = response.json()
    assert data["version"] == "0.1.1"
