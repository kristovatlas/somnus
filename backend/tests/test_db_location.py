"""Launcher DB-location selection (#41, ADR 015).

The interactive prompt is TTY-only and not exercised here; these cover the
non-interactive resolution precedence, persistence, validation, and the
headless (non-TTY) fallback — everything that runs unattended.
"""

import importlib
from pathlib import Path

import pytest

from backend import config, db_location


@pytest.fixture
def isolated_home(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point HOME + the config module at a throwaway dir; no SOMNUS_DB_PATH."""
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.delenv("SOMNUS_DB_PATH", raising=False)
    cfg = tmp_path / ".somnus" / "db-location"
    monkeypatch.setattr(config, "DEFAULT_DB_DIR", tmp_path / ".somnus")
    monkeypatch.setattr(config, "CONFIG_FILE", cfg)
    monkeypatch.setattr(db_location, "CONFIG_FILE", cfg)
    monkeypatch.setattr(db_location, "DEFAULT_DB_DIR", tmp_path / ".somnus")
    monkeypatch.setattr(db_location, "DEFAULT_DB_PATH", tmp_path / ".somnus" / "somnus.db")
    return tmp_path


def _resolved(monkeypatch: pytest.MonkeyPatch) -> Path:
    """settings.db_path recomputed via the default_factory (no env)."""
    return config._default_db_path()


def test_default_when_nothing_configured(isolated_home: Path) -> None:
    assert _resolved(pytest.MonkeyPatch()) == isolated_home / ".somnus" / "somnus.db"
    assert db_location.is_configured() is False


def test_flag_persists_and_is_then_resolved(isolated_home: Path) -> None:
    target = isolated_home / "vol" / "somnus.db"
    target.parent.mkdir()
    assert db_location.main(["--path", str(target)]) == 0
    assert config.read_saved_db_path() == str(target)
    assert config._default_db_path() == target
    assert db_location.is_configured() is True


def test_env_var_overrides_saved_config(
    isolated_home: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    saved = isolated_home / "vol" / "somnus.db"
    saved.parent.mkdir()
    db_location.main(["--path", str(saved)])
    # Env var wins over the saved file (pydantic env source > default_factory)
    monkeypatch.setenv("SOMNUS_DB_PATH", str(isolated_home / "env.db"))
    importlib.reload(config)
    try:
        assert config.Settings().db_path == isolated_home / "env.db"
    finally:
        importlib.reload(config)  # restore module state for other tests


def test_flag_rejects_unwritable_or_missing_parent(isolated_home: Path) -> None:
    rc = db_location.main(["--path", str(isolated_home / "nope" / "x.db")])
    assert rc == 2  # parent doesn't exist
    assert config.read_saved_db_path() is None  # nothing persisted


def test_flag_rejects_directory_target(isolated_home: Path) -> None:
    d = isolated_home / "adir"
    d.mkdir()
    assert db_location.main(["--path", str(d)]) == 2


def test_non_tty_unconfigured_does_not_block(
    isolated_home: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr("sys.stdin.isatty", lambda: False)
    assert db_location.main([]) == 0  # no prompt, no failure
    assert config.read_saved_db_path() is None
    assert "no TTY" in capsys.readouterr().err


def test_already_configured_is_a_noop(isolated_home: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SOMNUS_DB_PATH", str(isolated_home / "env.db"))
    # Even on a TTY, an existing config short-circuits without prompting.
    monkeypatch.setattr("sys.stdin.isatty", lambda: True)
    assert db_location.main([]) == 0


def test_validate_target_blank_and_expanduser(isolated_home: Path) -> None:
    path, reason = db_location._validate_target("   ")
    assert path is None and reason is not None
    # ~ expansion resolves under the (patched) HOME
    (isolated_home / ".somnus").mkdir(parents=True, exist_ok=True)
    path, reason = db_location._validate_target("~/.somnus/x.db")
    assert reason is None
    assert path == isolated_home / ".somnus" / "x.db"
