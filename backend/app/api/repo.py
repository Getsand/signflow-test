"""Repository for API keys and usage logs."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.models import ApiKey, ApiUsageLog


class ApiKeyRepository:
    """CRUD for API keys."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_key_hash(self, key_hash: str) -> ApiKey | None:
        """Find an active API key by its hash."""
        stmt = (
            select(ApiKey)
            .where(ApiKey.key_hash == key_hash, ApiKey.is_active.is_(True))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_owner(self, owner_id: UUID) -> list[ApiKey]:
        """List all API keys for a user (key value never returned)."""
        stmt = (
            select(ApiKey)
            .where(ApiKey.owner_id == owner_id)
            .order_by(ApiKey.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(
        self,
        *,
        key_hash: str,
        key_prefix: str,
        owner_id: UUID,
        name: str | None = None,
        rate_limit_per_minute: int = 60,
    ) -> ApiKey:
        """Create a new API key (caller hashes the key and passes hash/prefix)."""
        key = ApiKey(
            key_hash=key_hash,
            key_prefix=key_prefix,
            owner_id=owner_id,
            name=name,
            rate_limit_per_minute=rate_limit_per_minute,
        )
        self.session.add(key)
        await self.session.flush()
        await self.session.refresh(key)
        return key

    async def revoke(self, key_id: UUID, owner_id: UUID) -> bool:
        """Deactivate an API key. Returns True if found and revoked."""
        stmt = select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.owner_id == owner_id,
        )
        result = await self.session.execute(stmt)
        key = result.scalar_one_or_none()
        if not key:
            return False
        key.is_active = False
        await self.session.flush()
        return True


class ApiUsageLogRepository:
    """Append-only usage logs."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def append(
        self,
        *,
        api_key_id: UUID,
        endpoint: str,
        method: str,
        status_code: int | None = None,
    ) -> None:
        """Log one API call."""
        log = ApiUsageLog(
            api_key_id=api_key_id,
            endpoint=endpoint,
            method=method,
            status_code=status_code,
        )
        self.session.add(log)
        await self.session.flush()
