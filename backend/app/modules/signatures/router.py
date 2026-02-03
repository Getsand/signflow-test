"""
API endpoints for signature fields
"""
import logging
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.core.db import get_db
from app.core.security import get_current_user
from app.modules.auth.models import User
from app.modules.signatures.schemas import (
    SignatureFieldCreate,
    SignatureFieldOut,
    SignatureSubmit,
)
from app.modules.signatures.service import SignatureFieldService
from app.modules.signatures.repo import SignatureFieldRepository
from app.modules.files.repo import FileRepository


router = APIRouter(prefix="/api/v1/signatures", tags=["signatures"])


def get_signature_service(db: AsyncSession = Depends(get_db)) -> SignatureFieldService:
    """Dependency injection for signature service"""
    sig_repo = SignatureFieldRepository(db)
    file_repo = FileRepository(db)
    return SignatureFieldService(sig_repo=sig_repo, file_repo=file_repo)


@router.post("/fields", response_model=SignatureFieldOut, status_code=201)
async def create_signature_field(
    payload: SignatureFieldCreate,
    current_user: User = Depends(get_current_user),
    service: SignatureFieldService = Depends(get_signature_service),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a signature field (box) on a document.
    
    Rules:
    - Only file owner can create fields
    - File must exist and be owned by current user
    - Coordinates must be valid
    
    Returns the created signature field.
    """
    try:
        field = await service.create_field(
            file_id=payload.file_id,
            page_number=payload.page,
            x=payload.x,
            y=payload.y,
            width=payload.width,
            height=payload.height,
            assigned_to=payload.assigned_to,
            owner_id=current_user.id,
            field_type=payload.field_type,
            role=payload.role,
        )
        await db.commit()
        return field
        
    except ValueError as e:
        logger.warning("Create signature field validation error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Create signature field failed: %s", e)
        detail = str(e)
        raise HTTPException(status_code=500, detail=detail)


@router.get("/fields", response_model=List[SignatureFieldOut])
async def list_signature_fields(
    file_id: UUID = Query(..., description="UUID of the file"),
    current_user: User = Depends(get_current_user),
    service: SignatureFieldService = Depends(get_signature_service),
):
    """
    List all signature fields for a file.

    Rules:
    - File owner can see all fields
    - Assigned signer can see fields assigned to them

    Returns list of signature fields ordered by page and creation time.
    """
    try:
        fields = await service.list_fields(
            file_id=file_id,
            user_id=current_user.id,
        )
        return fields
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/fields/{field_id}", status_code=204)
async def delete_signature_field(
    field_id: UUID,
    current_user: User = Depends(get_current_user),
    service: SignatureFieldService = Depends(get_signature_service),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a signature field.
    
    Rules:
    - Only file owner can delete
    - Only if status is PENDING (not yet signed)
    
    Returns 204 No Content on success.
    """
    try:
        await service.delete_field(
            field_id=field_id,
            user_id=current_user.id,
        )
        await db.commit()
        return None
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/fields/{field_id}/sign", response_model=SignatureFieldOut)
async def sign_signature_field(
    field_id: UUID,
    payload: SignatureSubmit,
    current_user: User = Depends(get_current_user),
    service: SignatureFieldService = Depends(get_signature_service),
    db: AsyncSession = Depends(get_db),
):
    """
    Sign a signature field - applies signature to the PDF.
    
    This is the CORE signing operation that:
    1. Validates authorization (only assigned user can sign)
    2. Checks sequential signing (previous fields must be signed first)
    3. Downloads PDF from MinIO
    4. Applies signature image/text to PDF at specified coordinates
    5. Uploads modified PDF back to MinIO
    6. Marks field as SIGNED
    7. If all fields signed, locks the file
    
    Rules:
    - Only assigned user can sign
    - Field must be PENDING
    - File must not be LOCKED
    - Sequential signing enforced
    
    Request body:
    - signature_type: "DRAW" | "UPLOAD" | "TYPED"
    - signature_image_base64: Required for DRAW/UPLOAD
    - typed_name: Required for TYPED
    
    Returns the updated signature field with status=SIGNED.
    """
    try:
        signed_field = await service.sign_field(
            field_id=field_id,
            user_id=current_user.id,
            signature_type=payload.signature_type,
            signature_image_base64=payload.signature_image_base64,
            typed_name=payload.typed_name,
        )
        await db.commit()
        return signed_field
        
    except ValueError as e:
        # Business logic errors (unauthorized, already signed, etc.)
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        # Unexpected errors
        raise HTTPException(status_code=500, detail=f"Signing failed: {str(e)}")
