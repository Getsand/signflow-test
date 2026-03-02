import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.schemas import UserCreate, UserLogin, UserRead
from app.modules.auth.service import AuthService
from app.modules.auth.repo import AuthRepository
from app.modules.auth.exceptions import UserInactiveError
from app.core.deps import get_current_user
from app.core.security import create_access_token
from app.core.db import get_db
from app.api.deps import _hash_key
from app.api.repo import ApiKeyRepository
from app.api.schemas import ApiKeyCreate

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["auth"],
)


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    repo = AuthRepository(db)
    service = AuthService(repo)

    try:
        user = await service.register_user(
            email=user_in.email,
            password=user_in.password,
        )
        return user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/login")
async def login(
    login_in: UserLogin,
    db: AsyncSession = Depends(get_db),
):
    repo = AuthRepository(db)
    service = AuthService(repo)

    try:
        user = await service.authenticate_user(
            email=login_in.email,
            password=login_in.password,
        )
        access_token = create_access_token(
            {"sub": str(user.id)}
        )
        # JWT will be added later
        return {
            "message": "Login successful",
            "access_token": access_token,
            "token_type": "bearer",
            "user_id": user.id,
        }
    except UserInactiveError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This user account is inactive.",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )


@router.get("/me", response_model=UserRead)
async def me(
    current_user=Depends(get_current_user),
):
    return current_user


# ---- API key creation (same as POST /api/v1/api-keys; under /auth so URL is like Login) ----
@router.post("/api-keys", status_code=status.HTTP_201_CREATED)
async def create_api_key(
    payload: ApiKeyCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create an API key. Use the access_token from Login as Bearer token (not JWT Secret)."""
    raw_key = "sk_live_" + secrets.token_urlsafe(32)
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
