"""Application configuration using pydantic-settings."""

from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Somnus application settings.

    Values can be set via environment variables prefixed with SOMNUS_.
    For example, SOMNUS_DB_PATH sets the database file path.
    """

    db_path: Path = Path.home() / ".somnus" / "somnus.db"
    cors_origins: list[str] = ["http://localhost:5173"]
    oura_api_base_url: str = "https://api.ouraring.com/v2"
    open_meteo_base_url: str = "https://archive-api.open-meteo.com"

    model_config = {"env_prefix": "SOMNUS_"}


settings = Settings()
