"""
Repository for API keys (wrapper DB only).
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ApiKey, ApiUsageLog
from app.security import hash_api_key, generate_api_key


async def get_api_key_by_plain(session: AsyncSession, plain_key: str) -> ApiKey | None:
    key_hash = hash_api_key(plain_key)
    result = await session.execute(select(ApiKey).where(ApiKey.key_hash == key_hash))
    return result.scalar_one_or_none()


async def get_api_key_by_hash(session: AsyncSession, key_hash: str) -> ApiKey | None:
    result = await session.execute(select(ApiKey).where(ApiKey.key_hash == key_hash))
    return result.scalar_one_or_none()


async def create_api_key(
    session: AsyncSession,
    company_name: str | None = None,
    rate_limit_per_minute: int = 60,
) -> tuple[ApiKey, str]:
    """Create a new API key. Returns (api_key_row, plain_key). Caller must show plain_key once."""
    plain_key, key_hash = generate_api_key()
    prefix = plain_key[:8] + "..." + plain_key[-4:] if len(plain_key) > 12 else plain_key
    row = ApiKey(
        key_hash=key_hash,
        key_prefix=prefix,
        company_name=company_name,
        status="active",
        rate_limit_per_minute=rate_limit_per_minute,
    )
    session.add(row)
    await session.flush()
    return row, plain_key


async def log_usage(
    session: AsyncSession,
    api_key_id: str,
    endpoint: str,
    method: str,
    status_code: int | None,
    ip: str | None,
):
    log = ApiUsageLog(
        api_key_id=api_key_id,
        endpoint=endpoint,
        method=method,
        status_code=status_code,
        ip=ip,
    )
    session.add(log)
