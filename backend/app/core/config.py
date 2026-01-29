from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    # App
    APP_NAME: str = "SignFlow"
    APP_ENV: str = "development"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = Field(..., env="DATABASE_URL")

    # Redis
    REDIS_URL: str = Field(..., env="REDIS_URL")

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
    RESEND_API_KEY: str = Field(default="", env="RESEND_API_KEY")
    EMAIL_FROM: str = Field(default="noreply@signflow.app", env="EMAIL_FROM")
    FRONTEND_BASE_URL: str = Field(default="http://localhost:5173", env="FRONTEND_BASE_URL")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()


# 🔴 THIS IS WHAT ALEMBIC EXPECTS
# settings = get_settings()
