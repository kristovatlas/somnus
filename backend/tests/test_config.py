"""Tests for backend.config parsing (threat model T-01 override + Codespaces)."""

import pytest

from backend.config import Settings, codespaces_hosts


def test_allowed_hosts_csv_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """SOMNUS_ALLOWED_HOSTS as a comma-separated string parses (was a crash)."""
    monkeypatch.setenv("SOMNUS_ALLOWED_HOSTS", "localhost, 127.0.0.1, myhost.local")
    assert Settings().allowed_hosts == ["localhost", "127.0.0.1", "myhost.local"]


def test_allowed_hosts_json_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """A JSON array still parses too."""
    monkeypatch.setenv("SOMNUS_ALLOWED_HOSTS", '["a.example", "b.example"]')
    assert Settings().allowed_hosts == ["a.example", "b.example"]


def test_allowed_hosts_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """The loopback default is used when the env var is unset."""
    monkeypatch.delenv("SOMNUS_ALLOWED_HOSTS", raising=False)
    assert Settings().allowed_hosts == ["localhost", "127.0.0.1"]


def test_cors_origins_csv_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """SOMNUS_CORS_ORIGINS carries the same comma-separated parsing."""
    monkeypatch.setenv("SOMNUS_CORS_ORIGINS", "http://localhost:5173,http://localhost:4173")
    assert Settings().cors_origins == ["http://localhost:5173", "http://localhost:4173"]


def test_codespaces_hosts_present(monkeypatch: pytest.MonkeyPatch) -> None:
    """In a Codespace, the forwarded :8000 and :5173 hosts are derived."""
    monkeypatch.setenv("CODESPACE_NAME", "fluffy-space-guide")
    monkeypatch.setenv("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", "app.github.dev")
    assert codespaces_hosts() == [
        "fluffy-space-guide-8000.app.github.dev",
        "fluffy-space-guide-5173.app.github.dev",
    ]


def test_codespaces_hosts_absent(monkeypatch: pytest.MonkeyPatch) -> None:
    """Outside a Codespace the allow-list stays loopback-only."""
    monkeypatch.delenv("CODESPACE_NAME", raising=False)
    monkeypatch.delenv("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", raising=False)
    assert codespaces_hosts() == []
