"""
File upload routes
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import get_current_user
from app.modules.files.repo import FileRepository
from app.modules.files.service import FileService
from app.modules.files.schemas import PresignRequest, PresignResponse, FileOut

router = APIRouter(prefix="/api/v1/files", tags=["files"])


@router.post("/presign", response_model=PresignResponse)
async def presign_upload(
    payload: PresignRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Generate presigned upload URL.
    """
    service = FileService(FileRepository(db))

    try:
        return await service.create_presigned_upload(
            filename=payload.filename,
            mime_type=payload.mime_type,
            owner_id=current_user.id,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/{file_id}/finalize", response_model=FileOut)
async def finalize_file(
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Finalize file upload.
    """
    service = FileService(FileRepository(db))

    try:
        result = await service.finalize_upload(
            file_id=file_id,
            owner_id=current_user.id,
        )
        return result
        
    except ValueError as e:
        error_msg = str(e).lower()
        
        if "not found" in error_msg or "access denied" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
