from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # App
    APP_NAME: str = "SignFlo"
    APP_ENV: str = "development"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # Database (default "" so app can start and /health works; set in .env for full use)
    DATABASE_URL: str = Field(default="", env="DATABASE_URL")

    # Redis (default "" so app can start; set in .env for rate limiting etc.)
    REDIS_URL: str = Field(default="", env="REDIS_URL")

    # JWT Authentication
    JWT_SECRET_KEY: str = Field(default="dev-secret-key-change-in-production", env="SIGNFLOW_SECRET_KEY")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # MinIO
    MINIO_INTERNAL_ENDPOINT: str = "minio:9000"
    MINIO_PUBLIC_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "signflow-documents"
    MINIO_SECURE: bool = False

    # Email (Resend)
    # Source: 1) Environment variables (e.g. from Docker or shell), 2) .env file(s), 3) defaults below.
    # If you comment these in .env: restart may not clear them if they are already in the process
    # environment (e.g. Docker container was created with old .env). Recreate the container or start
    # the app in a clean shell to pick up the change.
    RESEND_API_KEY: str = Field(default="", env="RESEND_API_KEY")
    EMAIL_FROM: str = Field(default="noreply@signflo.app", env="EMAIL_FROM")
    FRONTEND_BASE_URL: str = Field(default="http://localhost:5173", env="FRONTEND_BASE_URL")

    class Config:
        # Try .env in current dir (e.g. /app in Docker) and parent (e.g. project root when run from backend/)
        env_file = [".env", "../.env"]
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()


# 🔴 THIS IS WHAT ALEMBIC EXPECTS
# settings = get_settings()
