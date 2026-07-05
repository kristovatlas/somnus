"""Tests for TrustedHostMiddleware — threat model T-01 (DNS-rebinding defense).

The localhost API is unauthenticated, so its safety depends on only being
reachable via loopback. TrustedHostMiddleware rejects any request whose Host
header is not an allowed loopback name, which blocks the DNS-rebinding path
that would otherwise defeat the CORS origin pin.
"""

import pytest
from fastapi.testclient import TestClient


def test_default_localhost_host_accepted(client: TestClient) -> None:
    """The normal loopback Host (set by the client fixture) is accepted."""
    resp = client.get("/api/health", headers={"host": "localhost"})
    assert resp.status_code == 200


def test_loopback_ip_host_accepted(client: TestClient) -> None:
    """127.0.0.1 is an allowed host."""
    resp = client.get("/api/health", headers={"host": "127.0.0.1"})
    assert resp.status_code == 200


def test_host_with_port_accepted(client: TestClient) -> None:
    """The port is ignored when matching, so localhost:8000 is accepted."""
    resp = client.get("/api/health", headers={"host": "localhost:8000"})
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
