"""Tests for TrustedHostMiddleware — threat model T-01 (DNS-rebinding defense).

The localhost API is unauthenticated, so its safety depends on only being
reachable via loopback. TrustedHostMiddleware rejects any request whose Host
header is not an allowed loopback name, which blocks the DNS-rebinding path
that would otherwise defeat the CORS origin pin.
"""

import pytest
from fastapi.testclient import TestClient


@pytest.mark.parametrize(
    "good_host",
    [
        "localhost",
        "127.0.0.1",
        "localhost:8000",  # port is stripped before matching
    ],
)
def test_loopback_host_accepted(client: TestClient, good_host: str) -> None:
    """Loopback Hosts (with or without a port) are accepted."""
    resp = client.get("/api/health", headers={"host": good_host})
    assert resp.status_code == 200


@pytest.mark.parametrize(
    "bad_host",
    [
        "evil.example.com",
        "attacker.test",
        "somnus.attacker.test",  # a rebound attacker-controlled hostname
        "192.168.1.50",  # a LAN address, not loopback
    ],
)
def test_non_loopback_host_rejected(client: TestClient, bad_host: str) -> None:
    """A non-loopback Host (the DNS-rebinding vector) is rejected with 400."""
    resp = client.get("/api/health", headers={"host": bad_host})
    assert resp.status_code == 400
