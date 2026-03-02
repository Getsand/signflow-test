"""Dependencies for public API: API key auth and rate limiting."""

import hashlib
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.api.models import ApiKey
from app.api.repo import ApiKeyRepository
from app.core.config import get_settings

settings = get_settings()


def _hash_key(raw_key: str) -> str:
    """SHA-256 hash of the API key for storage/lookup."""
    return hashlib.sha256(raw_key.encode()).hexdigest()


def _extract_bearer_or_apikey_from_request(request: Request) -> str | None:
    """Parse Authorization header: 'Bearer <key>' or 'ApiKey <key>'."""
    auth = request.headers.get("Authorization") or request.headers.get("authorization")
    if not auth or " " not in auth:
        return None
    scheme, _, value = auth.partition(" ")
    if not value.strip():
        return None
    if scheme.lower() in ("bearer", "apikey"):
        return value.strip()
    return None


async def get_api_key_entity(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiKey:
    """Resolve API key from Authorization header. Raises 401 if missing/invalid."""
    raw = _extract_bearer_or_apikey_from_request(request)
    if not raw or not raw.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid API key. Use Authorization: Bearer <key> or ApiKey <key>.",
        )
    key_hash = _hash_key(raw.strip())
    repo = ApiKeyRepository(db)
    api_key = await repo.get_by_key_hash(key_hash)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key.",
        )
    return api_key


async def check_rate_limit(api_key_entity: ApiKey) -> None:
    """Enforce per-key rate limit using Redis. No-op if REDIS_URL not set."""
    if not (settings.REDIS_URL and settings.REDIS_URL.strip()):
        return
    try:
        import redis.asyncio as redis
        from datetime import datetime, timezone

        client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        key = f"api_rate:{api_key_entity.id}:{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"
        limit = api_key_entity.rate_limit_per_minute
        count = await client.incr(key)
        if count == 1:
            await client.expire(key, 90)
        await client.aclose()
        if count > limit:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Limit: {limit} requests per minute.",
            )
    except Exception:
        pass  # If Redis fails, allow request (do not block API)


async def get_validated_api_key(
    api_key_entity: Annotated[ApiKey, Depends(get_api_key_entity)],
) -> ApiKey:
    """Validate API key and enforce rate limit."""
    await check_rate_limit(api_key_entity)
    return api_key_entity


# Export for tests
__all__ = ["_hash_key", "get_validated_api_key", "get_api_key_entity"]
