"""Public API: API key management (JWT required)."""

import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user
from app.modules.auth.models import User
from app.api.deps import _hash_key
from app.api.repo import ApiKeyRepository
from app.api.schemas import ApiResponse, ApiKeyCreate, ApiKeyListItem

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


def _generate_raw_key() -> str:
    """Generate a new API key (e.g. sk_live_<random>). Shown only once."""
    return "sk_live_" + secrets.token_urlsafe(32)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_api_key(
    payload: ApiKeyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create an API key. The raw key is returned only in this response; store it securely."""
    raw_key = _generate_raw_key()
    key_hash = _hash_key(raw_key)
    key_prefix = raw_key[:12] + "…"
    repo = ApiKeyRepository(db)
    key = await repo.create(
        key_hash=key_hash,
        key_prefix=key_prefix,
        owner_id=current_user.id,
        name=payload.name,
        rate_limit_per_minute=payload.rate_limit_per_minute,
    )
    await db.commit()
    await db.refresh(key)
    return {
        "id": str(key.id),
        "key_prefix": key.key_prefix,
        "name": key.name,
        "rate_limit_per_minute": key.rate_limit_per_minute,
        "api_key": raw_key,
        "created_at": key.created_at.isoformat(),
    }


@router.get("", response_model=ApiResponse[list])
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List API keys for the current user (raw key never returned)."""
    repo = ApiKeyRepository(db)
    keys = await repo.list_by_owner(owner_id=current_user.id)
    return ApiResponse.success(
        data=[
            ApiKeyListItem(
                id=k.id,
                key_prefix=k.key_prefix,
                name=k.name,
                rate_limit_per_minute=k.rate_limit_per_minute,
                is_active=k.is_active,
                created_at=k.created_at,
            )
            for k in keys
        ]
    )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke (deactivate) an API key."""
    repo = ApiKeyRepository(db)
    ok = await repo.revoke(key_id=key_id, owner_id=current_user.id)
    await db.commit()
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found or access denied",
        )
