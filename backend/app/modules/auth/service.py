from typing import Optional


from app.modules.auth.repo import AuthRepository
from app.modules.auth.constants import PASSWORD_MIN_LENGTH
from app.modules.auth.exceptions import (
    UserAlreadyExistsError,
    InvalidCredentialsError,
)

from passlib.context import CryptContext

# Assume User SQLAlchemy model is defined and imported elsewhere

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
            raise ValueError(f"Password must be at least {PASSWORD_MIN_LENGTH} characters long.")
        hashed_password = pwd_context.hash(password)
        # User class must exist elsewhere with suitable constructor
        user = User(email=email, password_hash=hashed_password, name=name)
        created_user = await self.repo.create_user(user)
        return created_user

    async def authenticate_user(
        self, email: str, password: str
    ) -> "User":
        user = await self.repo.get_user_by_email(email)
        if user is None:
            raise InvalidCredentialsError()
        if not pwd_context.verify(password, user.password_hash):
            raise InvalidCredentialsError()
        return user
