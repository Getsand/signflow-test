"""
SigningRequest Service - Business logic
"""

from typing import List
from uuid import UUID
from datetime import datetime

from app.modules.signing_requests.repo import SigningRequestRepository
from app.modules.signing_requests.models import SigningRequestStatus
from app.modules.files.repo import FileRepository
from app.modules.signatures.repo import SignatureFieldRepository
from app.modules.signatures.models import SignatureFieldStatus


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
    ):
        """
        Create a signing request from an uploaded file.
        
        Rules:
        - File must exist and be owned by user
        - File must be COMPLETED (not UPLOADING or FAILED)
        - No existing signing request for this file
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
        
        # Create signing request
        signing_request = await self.signing_request_repo.create(
            file_id=file_id,
            owner_id=owner_id,
            title=title or file_obj.filename,
        )
        
        return signing_request

    async def get_signing_request(
        self,
        *,
        signing_request_id: UUID,
        owner_id: UUID,
    ):
        """Get signing request with file and signature field details"""
        signing_request = await self.signing_request_repo.get_by_id(
            signing_request_id=signing_request_id,
            owner_id=owner_id,
        )
        
        if not signing_request:
            raise ValueError("Signing request not found or access denied")
        
        # Get signature field counts
        signature_fields = await self.signature_repo.list_by_file(
            file_id=signing_request.file_id
        )
        
        total_fields = len(signature_fields)
        signed_fields = sum(1 for f in signature_fields if f.status == SignatureFieldStatus.SIGNED)
        
        return {
            "signing_request": signing_request,
            "total_signature_fields": total_fields,
            "signed_fields_count": signed_fields,
        }

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
        
        # Update status
        signing_request.status = SigningRequestStatus.SENT
        signing_request.sent_at = datetime.utcnow()
        
        return signing_request

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
