import asyncio
from typing import Optional

from app.modules.auth.models import User

from app.modules.auth.repo import AuthRepository
from app.modules.auth.constants import PASSWORD_MIN_LENGTH
from app.modules.auth.exceptions import (
    UserAlreadyExistsError,
    InvalidCredentialsError,
)

from passlib.context import CryptContext

# Assume User SQLAlchemy model is defined and imported elsewhere

# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
)


def _hash_password(password: str) -> str:
    """Sync hash for running in thread pool (avoids blocking event loop)."""
    return pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    """Sync verify for running in thread pool (avoids blocking event loop)."""
    return pwd_context.verify(plain, hashed)


class AuthService:
    def __init__(self, repo: AuthRepository):
        self.repo = repo

    async def register_user(
        self, email: str, password: str, name: Optional[str] = None
    ) -> "User":
        existing_user = await self.repo.get_user_by_email(email)
        if existing_user:
            raise UserAlreadyExistsError()

        if len(password) < PASSWORD_MIN_LENGTH:
            raise ValueError(
                f"Password must be at least {PASSWORD_MIN_LENGTH} characters long."
            )
        # Run CPU-heavy Argon2 in thread pool so event loop stays responsive (fixes socket hang up)
        loop = asyncio.get_event_loop()
        hashed_password = await loop.run_in_executor(None, _hash_password, password)
        user = User(email=email, password_hash=hashed_password, name=name)
        created_user = await self.repo.create_user(user)
        return created_user

    async def authenticate_user(
        self, email: str, password: str
    ) -> "User":
        user = await self.repo.get_user_by_email(email)
        if user is None:
            raise InvalidCredentialsError()
        loop = asyncio.get_event_loop()
        ok = await loop.run_in_executor(
            None, _verify_password, password, user.password_hash
        )
        if not ok:
            raise InvalidCredentialsError()
        return user
