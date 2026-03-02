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
        
        Templates can be used multiple times; each call creates a new signing request
        for the same file (template).
        
        Rules:
        - File must exist and be owned by user
        - File must be COMPLETED (not UPLOADING or FAILED)
        - Recipients must be provided
        - All roles in recipients must have unique emails
        """
        # Verify file exists and user owns it
        file_obj = await self.file_repo.get_by_id(file_id=file_id, owner_id=owner_id)
        if not file_obj:
            raise ValueError("File not found or access denied")
        
        if file_obj.status.value != "COMPLETED":
            raise ValueError("File must be in COMPLETED status")
        
        # Template can be used multiple times — no "one signing request per file" check
        
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

        # Map role -> recipient for this signing request
        recipients_by_role = {
            r.role: r for r in (signing_request.recipients or [])
        }

        # Check if all fields are missing roles (legacy template)
        fields_without_role = [f for f in template_fields if not getattr(f, "role", None)]
        
        # Safe fallback: if ALL fields lack roles AND there's exactly one recipient, infer "Me" or the recipient's role
        if fields_without_role and len(fields_without_role) == len(template_fields) and len(recipients_by_role) == 1:
            # Single recipient - all fields belong to this recipient
            inferred_role = list(recipients_by_role.keys())[0]
            logger.info(
                "Template has %d fields without roles but only one recipient '%s'. "
                "Inferring role automatically.",
                len(fields_without_role),
                inferred_role
            )
        elif fields_without_role:
            # Multiple recipients or mixed fields - require explicit repair
            raise ValueError(
                "Template field is missing a role assignment. "
                "This template has older fields created before role support. "
                "Please go to the Prepare page for this template and click the 'Repair fields' button "
                "to assign roles to all fields, then try creating the signing request again."
            )
        else:
            inferred_role = None

        fields_to_create: List[SigningRequestField] = []

        for field in template_fields:
            # Get role: use field.role if available, otherwise use inferred_role (for single-recipient legacy templates)
            role = getattr(field, "role", None) or inferred_role
            if not role:
                raise ValueError(
                    "Template field is missing a role assignment. "
                    "This template has older fields created before role support. "
                    "Please go to the Prepare page for this template and click the 'Repair fields' button "
                    "to assign roles to all fields, then try creating the signing request again."
                )

            recipient = recipients_by_role.get(role)
            if not recipient:
                # STRICT: do not silently default; roles must match recipients
                raise ValueError(
                    f"Template field role '{role}' has no matching recipient. "
                    "Please ensure all template roles are present on the signing request."
                )

            fields_to_create.append(
                SigningRequestField(
                    signing_request_id=signing_request.id,
                    template_field_id=field.id,
                    recipient_id=recipient.id,
                    role=role,
                    field_type=getattr(field, 'field_type', 'SIGNATURE'),  # Copy field_type from template field
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

        # Flush session to ensure recipients and fields are available for email sending
        await self.signing_request_repo.session.flush()

        # Automatically send emails to signers after creating the request
        try:
            signing_request, sent, failed_recipients = await self.transition_to_sent(
                signing_request_id=signing_request.id,
                owner_id=owner_id,
            )
            if sent:
                logger.info(
                    "Signing request %s automatically sent to recipients (failed: %s)",
                    signing_request.id,
                    failed_recipients,
                )
            else:
                logger.warning(
                    "Signing request %s created but email sending failed for all recipients: %s",
                    signing_request.id,
                    failed_recipients,
                )
        except Exception as e:
            # Log error but don't fail the request creation
            # The request is still created and can be sent manually later
            logger.error(
                "Failed to automatically send signing request %s: %s",
                signing_request.id,
                str(e),
                exc_info=True,
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
        
        # For SEQUENTIAL order, only send to the first recipient; others get the email when previous signer completes
        recipients_to_email = (
            recipients[:1] if signing_request.signing_order == SigningOrder.SEQUENTIAL
            else recipients
        )
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Sending signing request {signing_request_id} to {len(recipients_to_email)} recipient(s) (order={signing_request.signing_order.value})")
        
        for recipient in recipients_to_email:
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
            logger.info(f"Signing request {signing_request_id} marked as SENT ({len(successful_emails)}/{len(recipients_to_email)} emails sent)")
        else:
            logger.warning(f"Signing request {signing_request_id} remains DRAFT (all {len(recipients_to_email)} emails failed)")
        
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
