"""
Public Signing Router - Token-based signing endpoints

These endpoints are PUBLIC (no authentication required).
Access is controlled via signing tokens sent via email.
"""

from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.modules.signing_requests.repo import SigningRequestRepository
from app.modules.signing_requests.models import (
    SigningRequestRecipient,
    SigningRequestField,
    SigningRequestFieldStatus,
    RecipientStatus,
    SigningRequestStatus,
    SigningRequest,
    SigningOrder,
)
from app.core.email import EmailService
from app.modules.files.models import FileObject
from app.modules.signing_requests.schemas import (
    SignerContextResponse,
    RecipientOut,
    SigningRequestFieldOut,
    SignFieldRequest,
    SignFieldResponse,
)
from app.modules.files.repo import FileRepository
from app.core.storage import generate_presigned_get_url
from sqlalchemy import select
from sqlalchemy.orm import joinedload

router = APIRouter(prefix="/api/v1/signing", tags=["signing"])


@router.get("/by-token/{token}", response_model=SignerContextResponse)
async def get_signer_context(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get signing context for a token (public endpoint).
    
    Returns:
    - Recipient information
    - Signing request details
    - PDF view URL
    - Fields assigned to this recipient only
    
    Security:
    - Token must be valid and not expired
    - Recipient must not be already completed
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Getting signing context for token: {token[:20]}...")
        signing_request_repo = SigningRequestRepository(db)
        
        # Find recipient by token with eager loading
        stmt = (
            select(SigningRequestRecipient)
            .where(SigningRequestRecipient.signing_token == token)
            .options(
                joinedload(SigningRequestRecipient.signing_request).joinedload(SigningRequest.file)
            )
        )
        
        result = await db.execute(stmt)
        recipient = result.unique().scalar_one_or_none()
        logger.info(f"Recipient found: {recipient is not None}")
        
        if not recipient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="This signing link is invalid or has already been used."
            )
        
        # Check if recipient is already completed
        if recipient.status == RecipientStatus.SIGNED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This signing link has already been used."
            )
        
        # Get signing request
        signing_request = recipient.signing_request
        if not signing_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Signing request not found."
            )
        
        # Get file object
        file_obj = signing_request.file
        if not file_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found."
            )
        
        # Get fields assigned to this recipient only
        fields = await signing_request_repo.list_fields_for_recipient(
            recipient_id=recipient.id
        )
        
        # Get PDF view URL using presigned URL
        pdf_view_url = generate_presigned_get_url(
            object_name=file_obj.storage_key,
            expires_minutes=60
        )
        
        return SignerContextResponse(
            recipient=RecipientOut(
                id=recipient.id,
                role=recipient.role,
                email=recipient.email,
                order_index=recipient.order_index,
                status=recipient.status.value,
                created_at=recipient.created_at,
                sent_at=recipient.sent_at,
            ),
            signing_request={
                "id": str(signing_request.id),
                "title": signing_request.title or signing_request.file.filename,
                "status": signing_request.status.value,
                "signing_order": signing_request.signing_order.value,
            },
            pdf_view_url=pdf_view_url,
            fields=[
                SigningRequestFieldOut(
                    id=field.id,
                    signing_request_id=field.signing_request_id,
                    template_field_id=field.template_field_id,
                    recipient_id=field.recipient_id,
                    role=field.role,
                    field_type=field.field_type,
                    page=field.page,
                    x=field.x,
                    y=field.y,
                    width=field.width,
                    height=field.height,
                    value=field.value,
                    status=field.status.value,
                    signed_at=field.signed_at,
                    created_at=field.created_at,
                )
                for field in fields
            ],
            signing_order=signing_request.signing_order.value,
        )
    except Exception as e:
        logger.error(f"Error getting signing context: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load signing context: {str(e)}"
        )


@router.post("/fields/{field_id}/sign", response_model=SignFieldResponse)
async def sign_field(
    field_id: UUID,
    payload: SignFieldRequest,
    token: str = Query(..., description="Signing token from email link"),
    db: AsyncSession = Depends(get_db),
):
    """
    Sign a field using token (public endpoint).
    
    Security:
    - Token must be valid
    - Field must belong to recipient associated with token
    - Field must be PENDING
    - Sequential signing enforced if signing_order = SEQUENTIAL
    """
    signing_request_repo = SigningRequestRepository(db)
    
    # Validate token and get recipient with signing request loaded
    stmt = (
        select(SigningRequestRecipient)
        .where(SigningRequestRecipient.signing_token == token)
        .options(joinedload(SigningRequestRecipient.signing_request))
    )
    result = await db.execute(stmt)
    recipient = result.unique().scalar_one_or_none()
    
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid signing token."
        )
    
    if recipient.status == RecipientStatus.SIGNED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This signing link has already been used."
        )
    
    # Get field
    stmt = select(SigningRequestField).where(SigningRequestField.id == field_id)
    result = await db.execute(stmt)
    field = result.scalar_one_or_none()
    
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field not found."
        )
    
    # Verify field belongs to this recipient
    if field.recipient_id != recipient.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to sign this field."
        )
    
    # Check field status
    if field.status == SigningRequestFieldStatus.SIGNED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This field has already been signed."
        )
    
    # Enforce sequential signing if needed
    signing_request = recipient.signing_request
    if signing_request.signing_order.value == "SEQUENTIAL":
        # Get all fields for this recipient, ordered by page and creation time
        all_fields = await signing_request_repo.list_fields_for_recipient(
            recipient_id=recipient.id
        )
        sorted_fields = sorted(all_fields, key=lambda f: (f.page, f.created_at))
        
        # Find current field index
        current_index = next(
            (i for i, f in enumerate(sorted_fields) if f.id == field_id),
            None
        )
        
        if current_index is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Field not found in recipient's field list."
            )
        
        # Check if previous fields are signed
        for i in range(current_index):
            if sorted_fields[i].status != SigningRequestFieldStatus.SIGNED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You must sign fields in order. Please sign previous fields first."
                )
    
    # Validate signature data
    if payload.signature_type == "DRAW":
        if not payload.signature_image_base64:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="signature_image_base64 is required for DRAW type."
            )
        field.value = payload.signature_image_base64
    elif payload.signature_type == "TYPED":
        if not payload.typed_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="typed_name is required for TYPED type."
            )
        field.value = payload.typed_name
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid signature_type: {payload.signature_type}"
        )
    
    # Mark field as signed
    field.status = SigningRequestFieldStatus.SIGNED
    field.signed_at = datetime.utcnow()
    await db.flush()
    
    # Check if all fields for this recipient are signed
    all_fields = await signing_request_repo.list_fields_for_recipient(
        recipient_id=recipient.id
    )
    all_fields_signed = all(
        f.status == SigningRequestFieldStatus.SIGNED for f in all_fields
    )
    
    return SignFieldResponse(
        field=SigningRequestFieldOut(
            id=field.id,
            signing_request_id=field.signing_request_id,
            template_field_id=field.template_field_id,
            recipient_id=field.recipient_id,
            role=field.role,
            field_type=field.field_type,
            page=field.page,
            x=field.x,
            y=field.y,
            width=field.width,
            height=field.height,
            value=field.value,
            status=field.status.value,
            signed_at=field.signed_at,
            created_at=field.created_at,
        ),
        all_fields_signed=all_fields_signed,
    )


@router.post("/complete", status_code=status.HTTP_200_OK)
async def complete_signing(
    token: str = Query(..., description="Signing token from email link"),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark recipient as completed and advance signing request status.
    
    Security:
    - Token must be valid
    - All fields for recipient must be signed
    """
    signing_request_repo = SigningRequestRepository(db)
    
    # Validate token and get recipient with signing request and file loaded (for "send to next" email title)
    stmt = (
        select(SigningRequestRecipient)
        .where(SigningRequestRecipient.signing_token == token)
        .options(
            joinedload(SigningRequestRecipient.signing_request).joinedload(SigningRequest.file)
        )
    )
    result = await db.execute(stmt)
    recipient = result.unique().scalar_one_or_none()
    
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid signing token."
        )
    
    if recipient.status == RecipientStatus.SIGNED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This signing link has already been used."
        )
    
    # Verify all fields are signed
    all_fields = await signing_request_repo.list_fields_for_recipient(
        recipient_id=recipient.id
    )
    
    if not all_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields found for this recipient."
        )
    
    unsigned_fields = [
        f for f in all_fields if f.status != SigningRequestFieldStatus.SIGNED
    ]
    
    if unsigned_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Please sign all fields before completing. {len(unsigned_fields)} field(s) remaining."
        )
    
    # Mark recipient as signed
    recipient.status = RecipientStatus.SIGNED
    await db.flush()
    
    # Update signing request status
    signing_request = recipient.signing_request
    
    # Check if any recipient has signed (IN_PROGRESS)
    all_recipients = await signing_request_repo.get_recipients(
        signing_request_id=signing_request.id
    )
    
    signed_count = sum(1 for r in all_recipients if r.status == RecipientStatus.SIGNED)
    total_count = len(all_recipients)
    
    if signed_count == total_count:
        # All recipients signed - mark as COMPLETED
        signing_request.status = SigningRequestStatus.COMPLETED
        signing_request.completed_at = datetime.utcnow()
    elif signed_count > 0:
        # At least one signed - mark as IN_PROGRESS
        if signing_request.status == SigningRequestStatus.SENT:
            signing_request.status = SigningRequestStatus.IN_PROGRESS
    
    # SEQUENTIAL: send invitation to the next recipient now that this signer has completed
    if signing_request.signing_order == SigningOrder.SEQUENTIAL and signed_count < total_count:
        current_index = next(
            (i for i, r in enumerate(all_recipients) if r.id == recipient.id),
            None,
        )
        if current_index is not None and current_index + 1 < len(all_recipients):
            next_recipient = all_recipients[current_index + 1]
            if next_recipient.sent_at is None:
                email_service = EmailService()
                signing_token = email_service.generate_signing_token()
                signing_url = email_service.build_signing_url(signing_token)
                document_title = signing_request.title or (signing_request.file.filename if signing_request.file else "Document")
                email_sent = email_service.send_signing_invitation(
                    to_email=next_recipient.email,
                    recipient_name=next_recipient.role,
                    document_title=document_title,
                    signing_url=signing_url,
                )
                if email_sent:
                    await signing_request_repo.update_recipient_token_and_sent_at(
                        recipient_id=next_recipient.id,
                        signing_token=signing_token,
                        sent_at=datetime.utcnow(),
                    )
    
    await db.commit()
    
    return {"message": "Signing completed successfully"}
