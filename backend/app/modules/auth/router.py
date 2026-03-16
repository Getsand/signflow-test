from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.schemas import UserCreate, UserLogin, UserRead
from app.modules.auth.service import AuthService
from app.modules.auth.repo import AuthRepository
from app.core.deps import get_current_user
from app.core.security import create_access_token
from app.core.db import get_db

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
