"""Public API: signing request endpoints (API key required)."""

import io
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from minio.error import S3Error

from app.core.db import get_db
from app.core.storage import get_internal_minio_client
from app.modules.signing_requests.repo import SigningRequestRepository
from app.modules.signing_requests.service import SigningRequestService
from app.modules.signing_requests.models import SigningRequestFieldStatus
from app.modules.files.repo import FileRepository
from app.modules.signatures.repo import SignatureFieldRepository
from app.modules.signatures.pdf_service import PDFSigningService
from app.api.deps import get_validated_api_key
from app.api.models import ApiKey
from app.modules.signing_requests.schemas import RecipientOut, SigningRequestFieldOut
from app.api.schemas import (
    ApiResponse,
    SigningRequestCreate,
    SigningRequestListItem,
    SigningRequestStats,
)

router = APIRouter(prefix="/requests", tags=["requests"])


def _signing_request_service(db: AsyncSession) -> SigningRequestService:
    return SigningRequestService(
        signing_request_repo=SigningRequestRepository(db),
        file_repo=FileRepository(db),
        signature_repo=SignatureFieldRepository(db),
    )


def _to_list_item(sr) -> SigningRequestListItem:
    """Build list item from signing request ORM (with file loaded)."""
    return SigningRequestListItem(
        id=sr.id,
        file_id=sr.file_id,
        title=sr.title or (sr.file.filename if sr.file else ""),
        status=sr.status.value,
        signing_order=sr.signing_order.value,
        created_at=sr.created_at,
        updated_at=sr.updated_at,
        sent_at=sr.sent_at,
        completed_at=sr.completed_at,
        filename=sr.file.filename if sr.file else "",
        file_status=sr.file.status.value if sr.file else "",
    )


@router.get("", response_model=ApiResponse[list])
async def list_signing_requests(
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """List all signing requests for the API key owner."""
    service = _signing_request_service(db)
    items = await service.list_signing_requests(owner_id=api_key.owner_id)
    return ApiResponse.success(data=[_to_list_item(sr) for sr in items])


@router.get("/stats", response_model=ApiResponse[SigningRequestStats])
async def get_stats(
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Get signing request counts by status."""
    service = _signing_request_service(db)
    stats = await service.get_stats(owner_id=api_key.owner_id)
    return ApiResponse.success(data=SigningRequestStats(**stats))


@router.post("", response_model=ApiResponse[dict], status_code=status.HTTP_201_CREATED)
async def create_signing_request(
    payload: SigningRequestCreate,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Create a signing request from a template file."""
    service = _signing_request_service(db)
    recipients_data = [
        {"role": r.role, "email": r.email, "order_index": r.order_index}
        for r in payload.recipients
    ]
    try:
        sr = await service.create_signing_request(
            file_id=payload.file_id,
            owner_id=api_key.owner_id,
            title=payload.title,
            signing_order=payload.signing_order,
            recipients=recipients_data,
        )
        await db.commit()
        return ApiResponse.success(
            data={
                "id": str(sr.id),
                "file_id": str(sr.file_id),
                "title": sr.title,
                "status": sr.status.value,
                "signing_order": sr.signing_order.value,
                "created_at": sr.created_at.isoformat(),
                "updated_at": sr.updated_at.isoformat(),
                "sent_at": sr.sent_at.isoformat() if sr.sent_at else None,
                "completed_at": sr.completed_at.isoformat() if sr.completed_at else None,
            },
            message="Signing request created",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{signing_request_id}", response_model=ApiResponse[dict])
async def get_signing_request(
    signing_request_id: UUID,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Get signing request details (recipients, fields)."""
    service = _signing_request_service(db)
    try:
        result = await service.get_signing_request(
            signing_request_id=signing_request_id,
            owner_id=api_key.owner_id,
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signing request not found or access denied",
        )
    sr = result["signing_request"]
    recipients = result.get("recipients") or []
    total_fields = result.get("total_signature_fields", 0)
    signed_count = result.get("signed_fields_count", 0)
    recipients_out = [
        RecipientOut(
            id=r.id,
            role=r.role,
            email=r.email,
            order_index=r.order_index,
            status=r.status.value,
            created_at=r.created_at,
            sent_at=r.sent_at,
        )
        for r in recipients
    ]
    fields_out = []
    if hasattr(sr, "fields") and sr.fields:
        for f in sr.fields:
            fields_out.append(
                SigningRequestFieldOut(
                    id=f.id,
                    signing_request_id=f.signing_request_id,
                    template_field_id=f.template_field_id,
                    recipient_id=f.recipient_id,
                    role=f.role,
                    field_type=getattr(f, "field_type", "SIGNATURE"),
                    page=f.page,
                    x=f.x,
                    y=f.y,
                    width=f.width,
                    height=f.height,
                    value=getattr(f, "value", None),
                    status=f.status.value,
                    signed_at=getattr(f, "signed_at", None),
                    created_at=f.created_at,
                )
            )
    return ApiResponse.success(
        data={
            "signing_request": {
                "id": str(sr.id),
                "file_id": str(sr.file_id),
                "title": sr.title,
                "status": sr.status.value,
                "signing_order": sr.signing_order.value,
                "created_at": sr.created_at.isoformat(),
                "updated_at": sr.updated_at.isoformat(),
                "sent_at": sr.sent_at.isoformat() if sr.sent_at else None,
                "completed_at": sr.completed_at.isoformat() if sr.completed_at else None,
            },
            "recipients": [r.model_dump() for r in recipients_out],
            "fields": [f.model_dump() for f in fields_out],
            "total_signature_fields": total_fields,
            "signed_fields_count": signed_count,
        }
    )


@router.post("/{signing_request_id}/send", response_model=ApiResponse[dict])
async def send_signing_request(
    signing_request_id: UUID,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Send the signing request (DRAFT → SENT)."""
    service = _signing_request_service(db)
    try:
        sr, sent, failed_recipients = await service.transition_to_sent(
            signing_request_id=signing_request_id,
            owner_id=api_key.owner_id,
        )
        await db.commit()
        return ApiResponse.success(
            data={
                "signing_request": {
                    "id": str(sr.id),
                    "status": sr.status.value,
                    "sent_at": sr.sent_at.isoformat() if sr.sent_at else None,
                },
                "sent": sent,
                "failed_recipients": failed_recipients,
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{signing_request_id}/download")
async def download_signed_pdf(
    signing_request_id: UUID,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Download signed PDF (all signatures applied). Returns binary PDF."""
    service = _signing_request_service(db)
    try:
        result = await service.get_signing_request(
            signing_request_id=signing_request_id,
            owner_id=api_key.owner_id,
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signing request not found or access denied",
        )
    sr = result["signing_request"]
    file_obj = sr.file
    if not file_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    signing_request_repo = SigningRequestRepository(db)
    all_fields = await signing_request_repo.list_fields_for_request(
        signing_request_id=signing_request_id,
    )
    signed_fields = [
        f for f in all_fields
        if f.status == SigningRequestFieldStatus.SIGNED and getattr(f, "value", None)
    ]
    minio_client = get_internal_minio_client()
    try:
        response = minio_client.get_object(
            bucket_name=file_obj.bucket,
            object_name=file_obj.storage_key,
        )
        pdf_bytes = response.read()
        response.close()
        response.release_conn()
    except S3Error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF file not found in storage",
        )
    if signed_fields:
        pdf_service = PDFSigningService()
        current_pdf_bytes = pdf_bytes
        for field in signed_fields:
            try:
                is_base64_image = (
                    getattr(field, "value", "") and (
                        str(field.value).startswith("data:image")
                        or (len(str(field.value)) > 100 and " " not in str(field.value))
                    )
                )
                if is_base64_image:
                    sig_data = str(field.value)
                    if sig_data.startswith("data:image"):
                        sig_data = sig_data.split(",", 1)[1]
                    current_pdf_bytes = pdf_service.apply_signature_to_pdf(
                        current_pdf_bytes,
                        page_number=field.page,
                        x=field.x,
                        y=field.y,
                        width=field.width,
                        height=field.height,
                        signature_image_base64=sig_data,
                    )
                else:
                    current_pdf_bytes = pdf_service.apply_signature_to_pdf(
                        current_pdf_bytes,
                        page_number=field.page,
                        x=field.x,
                        y=field.y,
                        width=field.width,
                        height=field.height,
                        typed_name=getattr(field, "value", "") or "",
                    )
            except Exception:
                continue
        pdf_bytes = current_pdf_bytes
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{file_obj.filename}"'
        },
    )


@router.delete("/{signing_request_id}", response_model=ApiResponse[None])
async def delete_signing_request(
    signing_request_id: UUID,
    db: AsyncSession = Depends(get_db),
    api_key: ApiKey = Depends(get_validated_api_key),
):
    """Delete a signing request (template file is not deleted)."""
    service = _signing_request_service(db)
    try:
        await service.delete_signing_request(
            signing_request_id=signing_request_id,
            owner_id=api_key.owner_id,
        )
        await db.commit()
        return ApiResponse.success(data=None, message="Signing request deleted")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signing request not found or access denied",
        )
