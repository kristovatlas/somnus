"""Application configuration using pydantic-settings."""

import json
import os
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode

# The app-managed data directory. Only this directory gets permission-hardened
# (T-08): a user-supplied SOMNUS_DB_PATH may live in a directory the user
# shares with other tools, which Somnus must not lock down.
DEFAULT_DB_DIR = Path.home() / ".somnus"

# Where the launcher (#41, ADR 015) persists the chosen DB path. Holds only a
# path string — no health data or token — so it lives in the app dir at fixed
# perms regardless of where the DB itself goes.
CONFIG_FILE = DEFAULT_DB_DIR / "db-location"


def read_saved_db_path() -> str | None:
    """The DB path saved by the launcher, or None if unset/blank/unreadable.

    Passive: never prompts. This is the config-file tier of the db_path
    precedence (env var > this > default); the interactive first-run prompt
    lives in ``backend.db_location.main`` and runs only from the launcher.
    """
    try:
        value = CONFIG_FILE.read_text().strip()
    except OSError:
        return None
    return value or None


def _default_db_path() -> Path:
    """db_path default: the launcher-saved path, else ``~/.somnus/somnus.db``.

    ``SOMNUS_DB_PATH`` (pydantic env source) still overrides this — env has
    higher precedence than a field default_factory.
    """
    saved = read_saved_db_path()
    return Path(saved) if saved else DEFAULT_DB_DIR / "somnus.db"


def codespaces_hosts(ports: tuple[int, ...] = (8000, 5173)) -> list[str]:
    """Forwarded hostnames for a GitHub Codespace, if running in one.

    In a Codespace, ports are forwarded to ``https://<name>-<port>.<domain>``,
    so a browser (or a direct request to the forwarded port) sends that Host
    rather than ``localhost``. Returns an empty list outside a Codespace, so the
    Host allow-list stays loopback-only for production / packaged builds.
    """
    name = os.environ.get("CODESPACE_NAME")
    domain = os.environ.get("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN")
    if not name or not domain:
        return []
    return [f"{name}-{port}.{domain}" for port in ports]


class Settings(BaseSettings):
    """Somnus application settings.

    Values can be set via environment variables prefixed with SOMNUS_.
    For example, SOMNUS_DB_PATH sets the database file path. List-valued
    settings (SOMNUS_ALLOWED_HOSTS, SOMNUS_CORS_ORIGINS) accept either a
    comma-separated string or a JSON array.
    """

    db_path: Path = Field(default_factory=_default_db_path)
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    allowed_hosts: Annotated[list[str], NoDecode] = ["localhost", "127.0.0.1"]
    oura_api_base_url: str = "https://api.ouraring.com/v2"
    open_meteo_base_url: str = "https://archive-api.open-meteo.com"

    model_config = {"env_prefix": "SOMNUS_"}

    @field_validator("cors_origins", "allowed_hosts", mode="before")
    @classmethod
    def _parse_list(cls, value: object) -> object:
        """Accept a comma-separated string or a JSON array for list settings.

        Without ``NoDecode`` + this validator, pydantic-settings JSON-decodes the
        raw env value and crashes on a plain ``SOMNUS_ALLOWED_HOSTS=a,b``. A
        default list value (no env override) passes straight through.
        """
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                return json.loads(stripped)
            return [item.strip() for item in stripped.split(",") if item.strip()]
        return value


settings = Settings()
