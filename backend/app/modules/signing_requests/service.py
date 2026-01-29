"""
SigningRequest Service - Business logic
"""

import logging
from typing import List
from uuid import UUID
from datetime import datetime

from app.modules.signing_requests.repo import SigningRequestRepository

logger = logging.getLogger(__name__)
from app.modules.signing_requests.models import (
    SigningRequestStatus,
    SigningOrder,
    RecipientStatus,
    SigningRequestField,
    SigningRequestFieldStatus,
)
from app.modules.files.repo import FileRepository
from app.modules.signatures.repo import SignatureFieldRepository
from app.modules.signatures.models import SignatureFieldStatus
from app.core.email import EmailService


class SigningRequestService:
    """Business logic for signing requests"""

    def __init__(
        self,
        signing_request_repo: SigningRequestRepository,
        file_repo: FileRepository,
        signature_repo: SignatureFieldRepository,
    ):
        self.signing_request_repo = signing_request_repo
        self.file_repo = file_repo
        self.signature_repo = signature_repo

    async def create_signing_request(
        self,
        *,
        file_id: UUID,
        owner_id: UUID,
        title: str = None,
        signing_order: str = "SEQUENTIAL",
        recipients: List[dict] = None,
    ):
        """
        Create a signing request from a template file.
        
        Rules:
        - File must exist and be owned by user
        - File must be COMPLETED (not UPLOADING or FAILED)
        - No existing signing request for this file
        - Recipients must be provided
        - All roles in recipients must have unique emails
        """
        # Verify file exists and user owns it
        file_obj = await self.file_repo.get_by_id(file_id=file_id, owner_id=owner_id)
        if not file_obj:
            raise ValueError("File not found or access denied")
        
        if file_obj.status.value != "COMPLETED":
            raise ValueError("File must be in COMPLETED status")
        
        # Check if signing request already exists
        existing = await self.signing_request_repo.get_by_file_id(file_id=file_id)
        if existing:
            raise ValueError("Signing request already exists for this file")
        
        # Validate recipients
        if not recipients or len(recipients) == 0:
            raise ValueError("At least one recipient is required")
        
        # Validate unique emails
        emails = [r["email"] for r in recipients]
        if len(emails) != len(set(emails)):
            raise ValueError("Duplicate email addresses are not allowed")
        
        # Convert signing_order string to enum
        signing_order_enum = SigningOrder.SEQUENTIAL if signing_order == "SEQUENTIAL" else SigningOrder.PARALLEL
        
        # Create signing request
        signing_request = await self.signing_request_repo.create(
            file_id=file_id,
            owner_id=owner_id,
            title=title or file_obj.filename,
            signing_order=signing_order_enum,
        )

        # Create recipients
        await self.signing_request_repo.create_recipients(
            signing_request_id=signing_request.id,
            recipients=recipients,
        )

        # Reload signing request with relationships to avoid lazy loading issues
        signing_request = await self.signing_request_repo.get_by_id(
            signing_request_id=signing_request.id,
            owner_id=owner_id,
        )

        # ------------------------------------------------------------------
        # Copy template signature fields into signing-request–scoped fields
        # ------------------------------------------------------------------
        # Load template fields for this file
        template_fields = await self.signature_repo.list_by_file(file_id=file_id)

        # Build mapping from assigned_to -> role, matching frontend logic
        # Frontend assigns roles based on first occurrence order of assigned_to
        role_by_assignee = {}
        role_index = 1
        for field in template_fields:
            if field.assigned_to not in role_by_assignee:
                role_by_assignee[field.assigned_to] = f"Signer {role_index}"
                role_index += 1

        # Map role -> recipient for this signing request
        recipients_by_role = {
            r.role: r for r in (signing_request.recipients or [])
        }

        fields_to_create: List[SigningRequestField] = []

        for field in template_fields:
            role = role_by_assignee.get(field.assigned_to)
            recipient = recipients_by_role.get(role) if role else None

            if not recipient:
                # Log and skip if we cannot resolve a recipient for this role
                logger.warning(
                    "Skipping template field %s: no recipient for role %s (assigned_to=%s)",
                    field.id,
                    role,
                    getattr(field, "assigned_to", None),
                )
                continue

            fields_to_create.append(
                SigningRequestField(
                    signing_request_id=signing_request.id,
                    template_field_id=field.id,
                    recipient_id=recipient.id,
                    role=role,
                    field_type="SIGNATURE",  # Default type for now
                    page=field.page_number,
                    x=field.x,
                    y=field.y,
                    width=field.width,
                    height=field.height,
                    status=SigningRequestFieldStatus.PENDING,
                )
            )

        if fields_to_create:
            # Persist signing request fields using repository method
            await self.signing_request_repo.create_fields_bulk(fields=fields_to_create)

            logger.info(
                "Created %d signing_request_fields for signing_request %s",
                len(fields_to_create),
                signing_request.id,
            )

        return signing_request

    async def get_signing_request(
        self,
        *,
        signing_request_id: UUID,
        owner_id: UUID,
    ):
        """Get signing request with file, recipients, and signature field details"""
        signing_request = await self.signing_request_repo.get_by_id(
            signing_request_id=signing_request_id,
            owner_id=owner_id,
        )
        
        if not signing_request:
            raise ValueError("Signing request not found or access denied")
        
        # Get recipients (already loaded via joinedload)
        recipients = signing_request.recipients or []
        
        # Get signature field counts
        signature_fields = await self.signature_repo.list_by_file(
            file_id=signing_request.file_id
        )
        
        total_fields = len(signature_fields)
        signed_fields = sum(1 for f in signature_fields if f.status == SignatureFieldStatus.SIGNED)
        
        return {
            "signing_request": signing_request,
            "recipients": recipients,
            "total_signature_fields": total_fields,
            "signed_fields_count": signed_fields,
        }

    async def delete_signing_request(
        self,
        *,
        signing_request_id: UUID,
        owner_id: UUID,
    ) -> None:
        """
        Delete a signing request.
        
        Rules:
        - Only owner can delete
        - CASCADE delete removes recipients and fields automatically
        
        Raises ValueError if not found or not authorized.
        """
        deleted = await self.signing_request_repo.delete(
            signing_request_id=signing_request_id,
            owner_id=owner_id,
        )
        
        if not deleted:
            raise ValueError("Signing request not found or access denied")
        
        logger.info(f"Deleted signing request {signing_request_id} by owner {owner_id}")

    async def list_signing_requests(
        self,
        *,
        owner_id: UUID,
    ):
        """List all signing requests for a user"""
        return await self.signing_request_repo.list_by_owner(owner_id=owner_id)

    async def get_stats(self, *, owner_id: UUID):
        """Get signing request statistics"""
        return await self.signing_request_repo.get_stats(owner_id=owner_id)

    async def transition_to_sent(
        self,
        *,
        signing_request_id: UUID,
        owner_id: UUID,
    ):
        """
        Transition signing request from DRAFT to SENT.
        
        Rules:
        - Must be in DRAFT status
        - Must have at least one signature field
        - Must have at least one recipient
        - Generate signing tokens for each recipient
        - Send invitation emails via EmailService
        - Track email success/failure
        - Only mark as SENT if at least one email succeeds
        
        Returns:
            Tuple of (signing_request, sent: bool, failed_recipients: List[str])
        """
        signing_request = await self.signing_request_repo.get_by_id(
            signing_request_id=signing_request_id,
            owner_id=owner_id,
        )
        
        if not signing_request:
            raise ValueError("Signing request not found or access denied")
        
        if signing_request.status != SigningRequestStatus.DRAFT:
            raise ValueError(f"Cannot send from {signing_request.status.value} status")
        
        # Check signature fields
        signature_fields = await self.signature_repo.list_by_file(
            file_id=signing_request.file_id
        )
        
        if not signature_fields:
            raise ValueError("Cannot send without signature fields")
        
        # Check recipients
        recipients = await self.signing_request_repo.get_recipients(
            signing_request_id=signing_request_id
        )
        
        if not recipients:
            raise ValueError("Cannot send without recipients")
        
        # Initialize email service
        email_service = EmailService()
        sent_at = datetime.utcnow()
        
        # Track email results
        successful_emails = []
        failed_recipients = []
        
        # Generate tokens and send emails for each recipient
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Sending signing request {signing_request_id} to {len(recipients)} recipient(s)")
        
        for recipient in recipients:
            # Generate unique signing token
            signing_token = email_service.generate_signing_token()
            
            # Build signing URL
            signing_url = email_service.build_signing_url(signing_token)
            
            # Send invitation email (synchronous call, but wrapped for async context)
            email_sent = email_service.send_signing_invitation(
                to_email=recipient.email,
                recipient_name=recipient.role,
                document_title=signing_request.title or signing_request.file.filename,
                signing_url=signing_url,
            )
            
            if email_sent:
                # Update recipient with token and sent_at
                await self.signing_request_repo.update_recipient_token_and_sent_at(
                    recipient_id=recipient.id,
                    signing_token=signing_token,
                    sent_at=sent_at,
                )
                successful_emails.append(recipient.email)
                logger.info(f"Email sent successfully to {recipient.email} (token: {signing_token[:8]}...)")
            else:
                failed_recipients.append(recipient.email)
                logger.warning(f"Failed to send email to {recipient.email}, but continuing...")
                # Still update token even if email fails (for manual retry later)
                await self.signing_request_repo.update_recipient_token_and_sent_at(
                    recipient_id=recipient.id,
                    signing_token=signing_token,
                    sent_at=None,  # Don't mark as sent if email failed
                )
        
        # Only mark as SENT if at least one email succeeded
        if successful_emails:
            signing_request.status = SigningRequestStatus.SENT
            signing_request.sent_at = sent_at
            logger.info(f"Signing request {signing_request_id} marked as SENT ({len(successful_emails)}/{len(recipients)} emails sent)")
        else:
            logger.warning(f"Signing request {signing_request_id} remains DRAFT (all {len(recipients)} emails failed)")
        
        return signing_request, len(successful_emails) > 0, failed_recipients

    async def auto_update_status(
        self,
        *,
        file_id: UUID,
    ):
        """
        Auto-update signing request status based on signature field progress.
        
        Called after a signature is added.
        
        Logic:
        - If SENT and at least 1 signature → IN_PROGRESS
        - If all signatures added → COMPLETED (and lock file)
        """
        signing_request = await self.signing_request_repo.get_by_file_id(file_id=file_id)
        
        if not signing_request:
            return  # No signing request for this file
        
        if signing_request.status == SigningRequestStatus.COMPLETED:
            return  # Already completed
        
        # Get signature fields
        signature_fields = await self.signature_repo.list_by_file(file_id=file_id)
        
        if not signature_fields:
            return
        
        total_fields = len(signature_fields)
        signed_fields = sum(1 for f in signature_fields if f.status == SignatureFieldStatus.SIGNED)
        
        # Check if all signed
        if signed_fields == total_fields and total_fields > 0:
            signing_request.status = SigningRequestStatus.COMPLETED
            signing_request.completed_at = datetime.utcnow()
        
        # Check if in progress
        elif signed_fields > 0 and signing_request.status == SigningRequestStatus.SENT:
            signing_request.status = SigningRequestStatus.IN_PROGRESS
