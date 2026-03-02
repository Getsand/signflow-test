"""Public API: user management (Zoho Sign–style). API key required."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.config import get_settings
from app.modules.auth.repo import AuthRepository
from app.modules.auth.service import AuthService
from app.modules.auth.exceptions import UserAlreadyExistsError
from app.core.email import EmailService
from app.api.deps import get_validated_api_key
from app.api.models import ApiKey
from app.api.schemas import (
    ApiResponse,
    UserInviteRequest,
    UserUpdateRequest,
    UserAccessUpdateRequest,
    UserRoleUpdateRequest,
)

router = APIRouter(prefix="/users", tags=["users"])
settings = get_settings()


def _user_to_data(user) -> dict:
    """Build response dict for a User model (handles optional fields for pre-migration)."""
    return {
        "id": str(user.id),
        "email": user.email,
        "name": getattr(user, "name", None),
        "is_verified": getattr(user, "is_verified", False),
        "is_active": getattr(user, "is_active", True),
        "role": getattr(user, "role", "member"),
        "invited_by_id": str(user.invited_by_id) if getattr(user, "invited_by_id", None) else None,
        "created_at": user.created_at.isoformat() if hasattr(user.created_at, "isoformat") else str(user.created_at),
    }


def _can_manage(owner_id: UUID, target_user) -> bool:
    """True if owner_id can manage target_user (self or invited by owner)."""
    if target_user.id == owner_id:
        return True
    return getattr(target_user, "invited_by_id", None) == owner_id


@router.get("/me", response_model=ApiResponse[dict])
async def get_current_user(
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Retrieve current user account details (API key owner)."""
    repo = AuthRepository(db)
    user = await repo.get_by_id(api_key.owner_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return ApiResponse.success(data=_user_to_data(user))


@router.get("", response_model=ApiResponse[list])
async def list_users(
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Retrieve users list: current user (owner) and users they invited."""
    repo = AuthRepository(db)
    users = await repo.list_users_for_owner(api_key.owner_id)
    return ApiResponse.success(data=[_user_to_data(u) for u in users])


@router.get("/{user_id}", response_model=ApiResponse[dict])
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Retrieve a user by ID (only self or users invited by you)."""
    repo = AuthRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not _can_manage(api_key.owner_id, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return ApiResponse.success(data=_user_to_data(user))


@router.post("/invite", response_model=ApiResponse[dict], status_code=status.HTTP_201_CREATED)
async def invite_user(
    payload: UserInviteRequest,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Invite a user: create account and send invite email with temporary password."""
    repo = AuthRepository(db)
    service = AuthService(repo)
    try:
        user = await service.invite_user(
            inviter_id=api_key.owner_id,
            email=payload.email,
            name=payload.name,
        )
    except UserAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )
    await db.commit()
    await db.refresh(user)
    temp_password = getattr(user, "_temp_password", None)
    login_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/login"
    if temp_password:
        email_svc = EmailService()
        email_svc.send_user_invite(
            to_email=user.email,
            recipient_name=user.name or "User",
            login_url=login_url,
            temp_password=temp_password,
        )
    return ApiResponse.success(
        data={
            **_user_to_data(user),
            "message": "User invited. They will receive an email with login details." if temp_password else "User created.",
        },
        message="User invited",
    )


@router.put("/{user_id}", response_model=ApiResponse[dict])
async def update_user(
    user_id: UUID,
    payload: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Update user profile (name). Only self or users you invited."""
    repo = AuthRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not _can_manage(api_key.owner_id, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    updated = await repo.update_user(user_id, name=payload.name)
    await db.commit()
    if updated:
        await db.refresh(updated)
    return ApiResponse.success(data=_user_to_data(updated or user), message="User updated")


@router.put("/{user_id}/access", response_model=ApiResponse[dict])
async def update_user_access(
    user_id: UUID,
    payload: UserAccessUpdateRequest,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Update user access (enable/disable). Only for users you invited (not self)."""
    repo = AuthRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not _can_manage(api_key.owner_id, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if user.id == api_key.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own access. Use another account to disable this user.",
        )
    updated = await repo.update_user(user_id, is_active=payload.enabled)
    await db.commit()
    if updated:
        await db.refresh(updated)
    return ApiResponse.success(data=_user_to_data(updated or user), message="Access updated")


@router.put("/{user_id}/role", response_model=ApiResponse[dict])
async def update_user_role(
    user_id: UUID,
    payload: UserRoleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Update user role. Only self or users you invited."""
    repo = AuthRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not _can_manage(api_key.owner_id, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    updated = await repo.update_user(user_id, role=payload.role.strip())
    await db.commit()
    if updated:
        await db.refresh(updated)
    return ApiResponse.success(data=_user_to_data(updated or user), message="Role updated")


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Delete a user. Only users you invited (not yourself)."""
    repo = AuthRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not _can_manage(api_key.owner_id, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if user.id == api_key.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account via this endpoint.",
        )
    ok = await repo.delete_user(user_id)
    await db.commit()
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
