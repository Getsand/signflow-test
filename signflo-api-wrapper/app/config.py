"""Wrapper config - env vars with defaults for light local run."""
from pathlib import Path
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


# .env next to this file (signflo-api-wrapper/app/) or in wrapper root
_env_dir = Path(__file__).resolve().parent.parent
_env_file = _env_dir / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_file if _env_file.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )
    app_name: str = "SignFlo API Wrapper"
    host: str = "0.0.0.0"
    port: int = 9080
    # SignFlo backend (your existing app on 8000)
    backend_base_url: str = "http://127.0.0.1:8000"
    request_timeout_seconds: float = 10.0

    # Backend service user (wrapper uses this to get JWT and proxy requests)
    backend_email: str = ""
    backend_password: str = ""

    # API key auth (store hashed keys; use a strong secret in production)
    api_key_hash_secret: str = "change-me-in-production"
    api_key_prefix: str = "sf_live_"
    # Rate limit per API key (requests per minute)
    rate_limit_per_minute: int = 60
    rate_limit_per_minute_pro: int = 500

    # Wrapper's own DB (SQLite by default; no backend DB changes)
    database_url: str = "sqlite+aiosqlite:///./data/wrapper.db"
    # Optional Redis for distributed rate limiting (empty = in-memory)
    redis_url: str = ""
    # Optional: set to allow creating first API key via X-Admin-Secret header (bootstrap)
    admin_secret: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
