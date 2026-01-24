"""
File upload routes
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.storage import generate_presigned_get_url
from app.modules.files.repo import FileRepository
from app.modules.files.service import FileService
from app.modules.files.schemas import (
    PresignRequest, 
    PresignResponse, 
    FileOut, 
    FileListItem,
    FileDetailOut,
    SignatureFieldSummary,
)
from app.modules.signatures.repo import SignatureFieldRepository
from app.modules.signatures.service import SignatureFieldService

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
    except ValueError as e:
        # User-friendly validation errors
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Production-safe: Log unexpected errors
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in presign_upload: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initialize upload. Please try again."
        )


@router.get("", response_model=List[FileListItem])
async def list_files(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    List all files owned by the current user.
    
    Returns files ordered by created_at DESC (newest first).
    """
    service = FileService(FileRepository(db))
    
    try:
        files = await service.list_user_files(owner_id=current_user.id)
        return files
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{file_id}", response_model=FileDetailOut)
async def get_file(
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get detailed information about a specific file.
    
    Returns:
    - File metadata
    - Signature fields (if any)
    - Lock status
    
    Only the file owner can access this endpoint.
    """
    file_service = FileService(FileRepository(db))
    sig_service = SignatureFieldService(
        sig_repo=SignatureFieldRepository(db),
        file_repo=FileRepository(db),
    )
    
    try:
        # Get file details with ownership check
        file_obj = await file_service.get_file_details(
            file_id=file_id,
            owner_id=current_user.id,
        )
        
        # Get signature fields for this file
        signature_fields = await sig_service.list_fields(
            file_id=file_id,
            user_id=current_user.id,
        )
        
        # Build response
        response = FileDetailOut(
            id=file_obj.id,
            filename=file_obj.filename,
            mime_type=file_obj.mime_type,
            size=file_obj.size,
            status=file_obj.status.value,
            bucket=file_obj.bucket,
            storage_key=file_obj.storage_key,
            document_hash=file_obj.document_hash,
            locked_at=file_obj.locked_at,
            created_at=file_obj.created_at,
            signature_fields=[
                SignatureFieldSummary(
                    id=field.id,
                    page_number=field.page_number,
                    x=field.x,
                    y=field.y,
                    width=field.width,
                    height=field.height,
                    assigned_to=field.assigned_to,
                    status=field.status.value,
                    signature_type=field.signature_type.value if field.signature_type else None,
                    signed_at=field.signed_at,
                    created_at=field.created_at,
                )
                for field in signature_fields
            ],
        )
        
        return response
        
    except ValueError as e:
        error_msg = str(e).lower()
        
        if "not found" in error_msg or "access denied" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e)
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=str(e)
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{file_id}/view-url")
async def get_file_view_url(
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get presigned GET URL for viewing/downloading a file.
    
    Returns a temporary URL that can be used to access the file directly.
    
    Verifies object exists in MinIO before generating URL.
    Returns 404 if file not found in storage.
    """
    from minio.error import S3Error
    import logging
    
    logger = logging.getLogger(__name__)
    service = FileService(FileRepository(db))
    
    try:
        file_obj = await service.get_file_details(
            file_id=file_id,
            owner_id=current_user.id,
        )
        
        # Log for debugging
        logger.info(
            f"Generating view URL for file_id={file_id}, "
            f"bucket={file_obj.bucket}, storage_key={file_obj.storage_key}"
        )
        
        # generate_presigned_get_url now verifies object exists
        # and raises S3Error if object is missing
        view_url = generate_presigned_get_url(file_obj.storage_key, expires_minutes=60)
        
        return {
            "view_url": view_url,
            "expires_in": 3600,  # 60 minutes in seconds
        }
    except S3Error as e:
        # Object not found in MinIO
        logger.error(
            f"Object not found in MinIO for file_id={file_id}: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found in storage: {str(e)}"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error generating view URL for file_id={file_id}: {e}", exc_info=True)
        # Production-safe: Don't expose internal errors to users
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate document view URL. Please try again."
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
