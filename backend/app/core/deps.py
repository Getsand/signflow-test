from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.modules.auth.models import User  # adjust if path differs
from app.modules.auth.repo import AuthRepository


async def get_current_user(
    db: AsyncSession = Depends(get_db),
):
    """
    Temporary current-user dependency.

    🔒 NOTE:
    - This is a stub for Milestone B2
    - JWT validation will be added later
    """
    # TODO: replace with real JWT extraction
    # For now, just block usage clearly
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication not implemented yet",
    )
