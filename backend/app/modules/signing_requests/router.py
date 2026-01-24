"""
SigningRequest API Routes
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user
from app.modules.signing_requests.repo import SigningRequestRepository
from app.modules.signing_requests.service import SigningRequestService
from app.modules.signing_requests.schemas import (
    SigningRequestCreate,
    SigningRequestListItem,
    SigningRequestDetail,
    SigningRequestStatsResponse,
)
from app.modules.files.repo import FileRepository
from app.modules.signatures.repo import SignatureFieldRepository

router = APIRouter(prefix="/api/v1/signing-requests", tags=["signing-requests"])


def get_signing_request_service(
    db: AsyncSession = Depends(get_db),
) -> SigningRequestService:
    """Dependency to get signing request service"""
    return SigningRequestService(
        signing_request_repo=SigningRequestRepository(db),
        file_repo=FileRepository(db),
        signature_repo=SignatureFieldRepository(db),
    )


@router.post("", response_model=SigningRequestListItem, status_code=status.HTTP_201_CREATED)
async def create_signing_request(
    data: SigningRequestCreate,
    current_user=Depends(get_current_user),
    service: SigningRequestService = Depends(get_signing_request_service),
):
    """
    Create a signing request from an uploaded file.
    
    Rules:
    - File must be COMPLETED
    - User must own the file
    - No duplicate signing requests
    """
    try:
        signing_request = await service.create_signing_request(
            file_id=data.file_id,
            owner_id=current_user.id,
            title=data.title,
        )
        
        return SigningRequestListItem(
            id=signing_request.id,
            file_id=signing_request.file_id,
            title=signing_request.title,
            status=signing_request.status.value,
            created_at=signing_request.created_at,
            updated_at=signing_request.updated_at,
            sent_at=signing_request.sent_at,
            completed_at=signing_request.completed_at,
            filename=signing_request.file.filename,
            file_status=signing_request.file.status.value,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("", response_model=List[SigningRequestListItem])
async def list_signing_requests(
    current_user=Depends(get_current_user),
    service: SigningRequestService = Depends(get_signing_request_service),
):
    """
    List all signing requests for the current user.
    
    Returns signing requests ordered by created_at DESC (newest first).
    """
    try:
        signing_requests = await service.list_signing_requests(owner_id=current_user.id)
        
        return [
            SigningRequestListItem(
                id=sr.id,
                file_id=sr.file_id,
                title=sr.title,
                status=sr.status.value,
                created_at=sr.created_at,
                updated_at=sr.updated_at,
                sent_at=sr.sent_at,
                completed_at=sr.completed_at,
                filename=sr.file.filename,
                file_status=sr.file.status.value,
            )
            for sr in signing_requests
        ]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/stats", response_model=SigningRequestStatsResponse)
async def get_signing_request_stats(
    current_user=Depends(get_current_user),
    service: SigningRequestService = Depends(get_signing_request_service),
):
    """
    Get signing request statistics for dashboard.
    
    Returns counts by status: total, draft, sent, in_progress, completed.
    """
    try:
        stats = await service.get_stats(owner_id=current_user.id)
        return SigningRequestStatsResponse(**stats)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{signing_request_id}", response_model=SigningRequestDetail)
async def get_signing_request(
    signing_request_id: UUID,
    current_user=Depends(get_current_user),
    service: SigningRequestService = Depends(get_signing_request_service),
):
    """
    Get detailed signing request information.
    
    Returns:
    - Signing request metadata
    - File information
    - Signature field counts
    
    Only the owner can access this endpoint.
    """
    try:
        result = await service.get_signing_request(
            signing_request_id=signing_request_id,
            owner_id=current_user.id,
        )
        
        sr = result["signing_request"]
        
        return SigningRequestDetail(
            id=sr.id,
            file_id=sr.file_id,
            owner_id=sr.owner_id,
            title=sr.title,
            status=sr.status.value,
            created_at=sr.created_at,
            updated_at=sr.updated_at,
            sent_at=sr.sent_at,
            completed_at=sr.completed_at,
            filename=sr.file.filename,
            mime_type=sr.file.mime_type,
            file_size=sr.file.size,
            file_status=sr.file.status.value,
            storage_key=sr.file.storage_key,
            total_signature_fields=result["total_signature_fields"],
            signed_fields_count=result["signed_fields_count"],
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{signing_request_id}/send", response_model=SigningRequestListItem)
async def send_signing_request(
    signing_request_id: UUID,
    current_user=Depends(get_current_user),
    service: SigningRequestService = Depends(get_signing_request_service),
):
    """
    Send signing request (transition from DRAFT to SENT).
    
    Rules:
    - Must be in DRAFT status
    - Must have at least one signature field
    """
    try:
        signing_request = await service.transition_to_sent(
            signing_request_id=signing_request_id,
            owner_id=current_user.id,
        )
        
        return SigningRequestListItem(
            id=signing_request.id,
            file_id=signing_request.file_id,
            title=signing_request.title,
            status=signing_request.status.value,
            created_at=signing_request.created_at,
            updated_at=signing_request.updated_at,
            sent_at=signing_request.sent_at,
            completed_at=signing_request.completed_at,
            filename=signing_request.file.filename,
            file_status=signing_request.file.status.value,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
