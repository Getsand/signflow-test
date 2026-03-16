"""
Create API keys (for admin or self-service). Returns plain key once.
Bootstrap: set ADMIN_SECRET in env and send X-Admin-Secret to create first key.
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db
from app.deps import get_api_key_from_request, check_rate_limit
from app.models import ApiKey
from app.repositories import create_api_key

router = APIRouter(prefix="/api/v1", tags=["Public API – Keys"])


class CreateKeyBody(BaseModel):
    company_name: Optional[str] = Field(None, max_length=255)
    rate_limit_per_minute: int = Field(60, ge=1, le=1000)


class CreateKeyResponse(BaseModel):
    api_key: str  # plain key - show once
    key_prefix: str
    company_name: Optional[str]
    rate_limit_per_minute: int


@router.post("/keys", status_code=status.HTTP_201_CREATED, response_model=CreateKeyResponse)
async def create_key(
    body: CreateKeyBody,
    request: Request,
    session: AsyncSession = Depends(get_db),
):
    """
    Create a new API key. The plain key is returned only once; store it securely.
    Auth: use Authorization: Bearer YOUR_API_KEY, or for first key set ADMIN_SECRET and send X-Admin-Secret.
    """
    settings = get_settings()
    admin = request.headers.get("X-Admin-Secret")
    if settings.admin_secret and admin == settings.admin_secret:
        # Bootstrap: no API key required; do not set request.state.api_key_id (no usage log)
        pass
    else:
        # Require valid API key and rate limit
        api_key = await get_api_key_from_request(request, session)
        await check_rate_limit(api_key)
        request.state.api_key_id = api_key.id
    row, plain_key = await create_api_key(
        session,
        company_name=body.company_name,
        rate_limit_per_minute=body.rate_limit_per_minute,
    )
    return CreateKeyResponse(
        api_key=plain_key,
        key_prefix=row.key_prefix,
        company_name=row.company_name,
        rate_limit_per_minute=row.rate_limit_per_minute,
    )
