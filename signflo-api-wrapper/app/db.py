"""
Wrapper's own DB (SQLite) for API keys and usage logs.
SignFlo backend DB is not touched.
"""
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.config import get_settings

settings = get_settings()
# Ensure SQLite dir exists; use path relative to cwd (e.g. signflo-api-wrapper/data)
if "sqlite" in settings.database_url:
    Path("data").mkdir(parents=True, exist_ok=True)

engine = create_async_engine(
    settings.database_url,
    echo=False,
)
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)
Base = declarative_base()


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create tables (idempotent)."""
    from app import models  # noqa: F401 - register models with Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
