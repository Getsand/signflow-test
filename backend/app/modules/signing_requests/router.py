"""
SigningRequest API Routes
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.db import get_db
from app.core.deps import get_current_user
from app.modules.signing_requests.repo import SigningRequestRepository
from app.modules.signing_requests.service import SigningRequestService
from app.modules.signing_requests.schemas import (
    SigningRequestCreate,
    SigningRequestListItem,
    SigningRequestDetail,
    SigningRequestStatsResponse,
    RecipientOut,
    SigningRequestFieldOut,
)
from app.modules.files.repo import FileRepository
from app.modules.signatures.repo import SignatureFieldRepository
from app.modules.signatures.pdf_service import PDFSigningService
from app.core.storage import get_internal_minio_client, MINIO_BUCKET
from app.modules.signing_requests.models import SigningRequestFieldStatus
from minio.error import S3Error
import io
from fastapi.responses import StreamingResponse

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
    db: AsyncSession = Depends(get_db),
):
    """
    Create a signing request from a template file.
    
    Rules:
    - File must be COMPLETED
    - User must own the file
    - No duplicate signing requests
    - Recipients must be provided with unique emails
    """
    try:
        # Convert recipients to dict format
        recipients_data = [
            {
                "role": r.role,
                "email": r.email,
                "order_index": r.order_index,
            }
            for r in data.recipients
        ]
        
        signing_request = await service.create_signing_request(
            file_id=data.file_id,
            owner_id=current_user.id,
            title=data.title,
            signing_order=data.signing_order,
            recipients=recipients_data,
        )
        
        await db.commit()
        
        return SigningRequestListItem(
            id=signing_request.id,
            file_id=signing_request.file_id,
            title=signing_request.title,
            status=signing_request.status.value,
            signing_order=signing_request.signing_order.value,
            created_at=signing_request.created_at,
            updated_at=signing_request.updated_at,
            sent_at=signing_request.sent_at,
            completed_at=signing_request.completed_at,
            filename=signing_request.file.filename,
            file_status=signing_request.file.status.value,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except IntegrityError as e:
        # Template reuse: if file_id unique constraint still exists, migration not run
        err_msg = str(e.orig) if hasattr(e, "orig") and e.orig else str(e)
        if "signing_requests_file_id_key" in err_msg or "duplicate key" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "This template was already used for another signing request. "
                    "Run the database migration to allow template reuse: alembic upgrade head"
                ),
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)
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
                signing_order=sr.signing_order.value,
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
    db: AsyncSession = Depends(get_db),
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
        
        # Convert recipients to response format
        recipients_out = [
            RecipientOut(
                id=r.id,
                role=r.role,
                email=r.email,
                order_index=r.order_index,
                status=r.status.value,
                created_at=r.created_at,
            )
            for r in result.get("recipients", [])
        ]
        
        # Get all fields for this signing request (including signed ones)
        signing_request_repo = SigningRequestRepository(db)
        all_fields = await signing_request_repo.list_fields_for_request(
            signing_request_id=signing_request_id
        )
        
        fields_out = [
            SigningRequestFieldOut(
                id=f.id,
                signing_request_id=f.signing_request_id,
                template_field_id=f.template_field_id,
                recipient_id=f.recipient_id,
                role=f.role,
                field_type=f.field_type,
                page=f.page,
                x=f.x,
                y=f.y,
                width=f.width,
                height=f.height,
                value=f.value,
                status=f.status.value,
                signed_at=f.signed_at,
                created_at=f.created_at,
            )
            for f in all_fields
        ]
        
        return SigningRequestDetail(
            id=sr.id,
            file_id=sr.file_id,
            owner_id=sr.owner_id,
            title=sr.title,
            status=sr.status.value,
            signing_order=sr.signing_order.value,
            created_at=sr.created_at,
            updated_at=sr.updated_at,
            sent_at=sr.sent_at,
            completed_at=sr.completed_at,
            filename=sr.file.filename,
            mime_type=sr.file.mime_type,
            file_size=sr.file.size,
            file_status=sr.file.status.value,
            storage_key=sr.file.storage_key,
            recipients=recipients_out,
            total_signature_fields=result["total_signature_fields"],
            signed_fields_count=result["signed_fields_count"],
            fields=fields_out,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{signing_request_id}/recipient-sign-tokens")
async def get_recipient_sign_tokens(
    signing_request_id: UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Read-only helper for the Zoho-compatible wrapper.

    Returns signing tokens for each recipient on a signing request so the wrapper can build
    `sign_url` values compatible with the existing token-based frontend signing flow.
    """
    repo = SigningRequestRepository(db)

    signing_request = await repo.get_by_id(
        signing_request_id=signing_request_id,
        owner_id=current_user.id,
    )
    if not signing_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Signing request not found")

    # Signing tokens are already stored on recipients when the request is sent.
    # For DRAFT/in-progress states, some tokens can be None.
    return [
        {
            "recipient_id": str(rec.id),
            "role": rec.role,
            "email": rec.email,
            "order_index": rec.order_index,
            "status": rec.status.value,
            "sent_at": rec.sent_at.isoformat() if rec.sent_at else None,
            "signing_token": rec.signing_token,
        }
        for rec in (signing_request.recipients or [])
    ]


@router.get("/{signing_request_id}/download")
async def download_signed_pdf(
    signing_request_id: UUID,
    current_user=Depends(get_current_user),
    service: SigningRequestService = Depends(get_signing_request_service),
    db: AsyncSession = Depends(get_db),
):
    """
    Download PDF with all signatures embedded.
    
    This endpoint:
    1. Fetches the signing request and all signed fields
    2. Downloads the original PDF from storage
    3. Applies all signatures to the PDF using PDFSigningService
    4. Returns the signed PDF as a download
    
    Only the owner can download.
    """
    try:
        # Get signing request
        result = await service.get_signing_request(
            signing_request_id=signing_request_id,
            owner_id=current_user.id,
        )
        
        sr = result["signing_request"]
        file_obj = sr.file
        
        if not file_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        # Get all signed fields
        signing_request_repo = SigningRequestRepository(db)
        all_fields = await signing_request_repo.list_fields_for_request(
            signing_request_id=signing_request_id
        )
        
        # Filter only signed fields
        signed_fields = [f for f in all_fields if f.status == SigningRequestFieldStatus.SIGNED and f.value]
        
        # Download original PDF
        minio_client = get_internal_minio_client()
        try:
            response = minio_client.get_object(
                bucket_name=file_obj.bucket,
                object_name=file_obj.storage_key,
            )
            pdf_bytes = response.read()
            response.close()
            response.release_conn()
        except S3Error as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"PDF file not found in storage: {str(e)}"
            )
        
        # Apply all signatures to PDF if any exist
        if signed_fields:
            pdf_service = PDFSigningService()
            current_pdf_bytes = pdf_bytes
            
            for field in signed_fields:
                try:
                    # Determine signature type
                    is_base64_image = (
                        field.value.startswith('data:image') or 
                        (len(field.value) > 100 and ' ' not in field.value)
                    )
                    
                    if is_base64_image:
                        # Extract base64 data if needed
                        signature_data = field.value
                        if signature_data.startswith('data:image'):
                            # Extract base64 part
                            signature_data = signature_data.split(',')[1]
                        
                        current_pdf_bytes = pdf_service.apply_signature_to_pdf(
                            current_pdf_bytes,
                            page_number=field.page,
                            x=field.x,
                            y=field.y,
                            width=field.width,
                            height=field.height,
                            signature_image_base64=signature_data,
                        )
                    else:
                        # Typed signature
                        current_pdf_bytes = pdf_service.apply_signature_to_pdf(
                            current_pdf_bytes,
                            page_number=field.page,
                            x=field.x,
                            y=field.y,
                            width=field.width,
                            height=field.height,
                            typed_name=field.value,
                        )
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(
                        f"Failed to apply signature for field {field.id} (role: {field.role}, page: {field.page}): {e}",
                        exc_info=True
                    )
                    # Continue with other signatures - don't fail entire download
                    # But log the error so we can debug
                    continue
            
            pdf_bytes = current_pdf_bytes
        
        # Return PDF as download
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{file_obj.filename}"'
            }
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error downloading signed PDF: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate signed PDF"
        )


@router.delete("/{signing_request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_signing_request(
    signing_request_id: UUID,
    current_user=Depends(get_current_user),
    service: SigningRequestService = Depends(get_signing_request_service),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a signing request.
    
    Rules:
    - Only the owner can delete
    - CASCADE delete automatically removes recipients and fields
    - Returns 204 No Content on success
    
    Note: This does NOT delete the underlying file/template.
    """
    try:
        await service.delete_signing_request(
            signing_request_id=signing_request_id,
            owner_id=current_user.id,
        )
        await db.commit()
        return None
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error deleting signing request {signing_request_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete signing request"
        )


@router.post("/{signing_request_id}/send")
async def send_signing_request(
    signing_request_id: UUID,
    current_user=Depends(get_current_user),
    service: SigningRequestService = Depends(get_signing_request_service),
    db: AsyncSession = Depends(get_db),
):
    """
    Send signing request (transition from DRAFT to SENT).
    
    Rules:
    - Must be in DRAFT status
    - Must have at least one signature field
    - Must have at least one recipient
    - Tracks email success/failure
    - Only marks as SENT if at least one email succeeds
    
    Returns:
        {
            "signing_request": SigningRequestListItem,
            "sent": bool,
            "failed_recipients": List[str]
        }
    """
    try:
        signing_request, sent, failed_recipients = await service.transition_to_sent(
            signing_request_id=signing_request_id,
            owner_id=current_user.id,
        )
        
        await db.commit()
        
        return {
            "signing_request": SigningRequestListItem(
                id=signing_request.id,
                file_id=signing_request.file_id,
                title=signing_request.title,
                status=signing_request.status.value,
                signing_order=signing_request.signing_order.value,
                created_at=signing_request.created_at,
                updated_at=signing_request.updated_at,
                sent_at=signing_request.sent_at,
                completed_at=signing_request.completed_at,
                filename=signing_request.file.filename,
                file_status=signing_request.file.status.value,
            ),
            "sent": sent,
            "failed_recipients": failed_recipients,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
