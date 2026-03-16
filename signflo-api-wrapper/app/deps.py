"""
Dependencies: API key auth and rate limiting.
"""
from __future__ import annotations

import time
import asyncio
from collections import defaultdict

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import ApiKey
from app.repositories import get_api_key_by_plain

security = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# In-memory rate limit: api_key_id -> list of request timestamps (last minute)
_rate_limit_store: dict[str, list[float]] = defaultdict(list)
_rate_limit_lock = asyncio.Lock()

# Paths that do NOT require API key (open)
OPEN_PATHS = frozenset({
    "/",
    "/ping",
    "/health",
    "/docs",
    "/openapi.json",
    "/api/v1",
    "/api/v1/backend/health",
    "/api/v1/keys",  # admin create key - we can require key or separate admin auth; for now allow open for testing, or remove
})


def _get_bearer_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    return auth[7:].strip() or None


async def get_api_key_from_request(
    request: Request,
    session: AsyncSession = Depends(get_db),
) -> ApiKey:
    """Resolve API key from Authorization: Bearer <key> or X-API-Key. Raises 401 if missing/invalid."""
    token = _get_bearer_token(request)
    if not token:
        token = request.headers.get("X-API-Key")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key. Use Authorization: Bearer YOUR_API_KEY or X-API-Key: YOUR_API_KEY",
        )
    key = await get_api_key_by_plain(session, token)
    if not key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    if key.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key is revoked",
        )
    return key


async def check_rate_limit(api_key: ApiKey) -> None:
    """Raises 429 if rate limit exceeded."""
    now = time.monotonic()
    window = 60.0  # 1 minute
    limit = api_key.rate_limit_per_minute
    async with _rate_limit_lock:
        times = _rate_limit_store[api_key.id]
        # Prune old
        times[:] = [t for t in times if now - t < window]
        if len(times) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Max {limit} requests per minute.",
            )
        times.append(now)


async def require_api_key(
    request: Request,
    api_key: ApiKey = Depends(get_api_key_from_request),
) -> ApiKey:
    """Require valid API key and enforce rate limit. Sets request.state.api_key_id for logging."""
    await check_rate_limit(api_key)
    request.state.api_key_id = api_key.id
    return api_key
