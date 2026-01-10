"""
Service layer for signature fields - business logic and authorization
"""
from typing import List
from uuid import UUID

from app.modules.signatures.repo import SignatureFieldRepository
from app.modules.signatures.models import SignatureField, SignatureFieldStatus
from app.modules.files.repo import FileRepository


class SignatureFieldService:
    """Business logic for signature fields"""

    def __init__(
        self, 
        sig_repo: SignatureFieldRepository,
        file_repo: FileRepository,
    ):
        self.sig_repo = sig_repo
        self.file_repo = file_repo

    async def create_field(
        self,
        *,
        file_id: UUID,
        page_number: int,
        x: float,
        y: float,
        width: float,
        height: float,
        assigned_to: UUID,
        owner_id: UUID,
    ) -> SignatureField:
        """
        Create a signature field.
        
        Rules:
        - Only file owner can create fields
        - File must exist
        - Coordinates must be valid
        """
        # Verify file exists and user owns it
        file_obj = await self.file_repo.get_by_id(
            file_id=file_id,
            owner_id=owner_id,
        )
        
        if not file_obj:
            raise ValueError("File not found or access denied")

        # Validate coordinates
        if width <= 0 or height <= 0:
            raise ValueError("Width and height must be positive")
        
        if page_number < 1:
            raise ValueError("Page number must be >= 1")

        # Create field
        field = await self.sig_repo.create(
            file_id=file_id,
            page_number=page_number,
            x=x,
            y=y,
            width=width,
            height=height,
            assigned_to=assigned_to,
        )

        return field

    async def list_fields(
        self,
        *,
        file_id: UUID,
        user_id: UUID,
    ) -> List[SignatureField]:
        """
        List signature fields for a file.
        
        Rules:
        - File owner can see all fields
        - Assigned signer can see all fields
        """
        # Get file to check ownership
        file_obj = await self.file_repo.get_by_id(
            file_id=file_id,
            owner_id=user_id,
        )

        # If user is not the owner, check if they're assigned to any field
        if not file_obj:
            # User is not owner - check if they have any assigned fields
            fields = await self.sig_repo.list_by_file(file_id)
            
            # Filter to only show fields assigned to this user
            user_fields = [f for f in fields if f.assigned_to == user_id]
            
            if not user_fields:
                raise ValueError("File not found or access denied")
            
            return user_fields

        # User is owner - return all fields
        return await self.sig_repo.list_by_file(file_id)

    async def delete_field(
        self,
        *,
        field_id: UUID,
        user_id: UUID,
    ) -> None:
        """
        Delete a signature field.
        
        Rules:
        - Only file owner can delete
        - Only if status is PENDING
        """
        # Get field
        field = await self.sig_repo.get_by_id(field_id)
        
        if not field:
            raise ValueError("Signature field not found")

        # Check if already signed
        if field.status == SignatureFieldStatus.SIGNED:
            raise ValueError("Cannot delete signed field")

        # Verify ownership
        file_obj = await self.file_repo.get_by_id(
            file_id=field.file_id,
            owner_id=user_id,
        )
        
        if not file_obj:
            raise ValueError("Only file owner can delete signature fields")

        # Delete
        deleted = await self.sig_repo.delete(field_id)
        
        if not deleted:
            raise ValueError("Failed to delete signature field")
