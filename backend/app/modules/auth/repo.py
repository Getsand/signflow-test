from typing import Optional, Sequence
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User


class AuthRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_user_by_email(self, email: str) -> Optional[User]:
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: str | UUID) -> Optional[User]:
        """Get user by ID (supports both string and UUID)"""
        if isinstance(user_id, str):
            user_id = UUID(user_id)
        result = await self.session.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def create_user(self, user: User) -> User:
        self.session.add(user)
        await self.session.flush()
        return user

    async def list_users_for_owner(self, owner_id: UUID) -> Sequence[User]:
        """List the owner and all users invited by the owner (for API user management)."""
        result = await self.session.execute(
            select(User).where(
                (User.id == owner_id) | (User.invited_by_id == owner_id)
            ).order_by(User.created_at.desc())
        )
        return result.scalars().all()

    async def update_user(
        self,
        user_id: UUID,
        *,
        name: Optional[str] = None,
        is_active: Optional[bool] = None,
        role: Optional[str] = None,
    ) -> Optional[User]:
        """Update user fields. Returns updated user or None if not found."""
        values = {}
        if name is not None:
            values["name"] = name
        if is_active is not None:
            values["is_active"] = is_active
        if role is not None:
            values["role"] = role
        if not values:
            return await self.get_by_id(user_id)
        await self.session.execute(update(User).where(User.id == user_id).values(**values))
        await self.session.flush()
        return await self.get_by_id(user_id)

    async def delete_user(self, user_id: UUID) -> bool:
        """Delete user by id. Returns True if a row was deleted."""
        result = await self.session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            return False
        await self.session.delete(user)
        await self.session.flush()
        return True
