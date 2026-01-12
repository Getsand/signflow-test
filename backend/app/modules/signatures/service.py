"""
Service layer for signature fields - business logic and authorization
"""
from typing import List
from uuid import UUID

from app.modules.signatures.repo import SignatureFieldRepository
from app.modules.signatures.models import SignatureField, SignatureFieldStatus
from app.modules.signatures.pdf_service import PDFSigningService
from app.modules.files.repo import FileRepository
from app.modules.files.models import FileStatus
from app.core.storage import get_internal_minio_client, MINIO_BUCKET


class SignatureFieldService:
    """Business logic for signature fields"""

    def __init__(
        self, 
        sig_repo: SignatureFieldRepository,
        file_repo: FileRepository,
    ):
        self.sig_repo = sig_repo
        self.file_repo = file_repo
        self.pdf_service = PDFSigningService()

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

    async def sign_field(
        self,
        *,
        field_id: UUID,
        user_id: UUID,
        signature_type: str,
        signature_image_base64: str = None,
        typed_name: str = None,
    ) -> SignatureField:
        """
        Sign a signature field and apply signature to PDF.
        
        CRITICAL FLOW:
        1. Validate authorization (only assigned user can sign)
        2. Check field is PENDING
        3. Check file is not LOCKED
        4. Enforce sequential signing (previous fields must be signed)
        5. Download PDF from MinIO
        6. Apply signature to PDF
        7. Upload modified PDF back to MinIO
        8. Calculate document hash
        9. Mark field as SIGNED
        10. If all fields signed, lock the file
        
        Args:
            field_id: UUID of signature field
            user_id: UUID of user attempting to sign
            signature_type: DRAW, UPLOAD, or TYPED
            signature_image_base64: Base64 image (for DRAW/UPLOAD)
            typed_name: Name for typed signature
        
        Returns:
            Updated signature field
        
        Raises:
            ValueError: If validation fails
        """
        # 1. Get signature field
        field = await self.sig_repo.get_by_id(field_id)
        if not field:
            raise ValueError("Signature field not found")

        # 2. Check authorization (only assigned user can sign)
        if field.assigned_to != user_id:
            raise ValueError("Only the assigned user can sign this field")

        # 3. Check field status
        if field.status == SignatureFieldStatus.SIGNED:
            raise ValueError("This field has already been signed")

        # 4. Get file object
        file_obj = await self.file_repo.get_by_id_no_ownership_check(field.file_id)
        if not file_obj:
            raise ValueError("File not found")

        # 5. Check file is not locked
        if file_obj.status == FileStatus.LOCKED:
            raise ValueError("Cannot sign a locked document")

        # 6. Enforce sequential signing
        await self._enforce_sequential_signing(field)

        # 7. Download PDF from MinIO
        minio_client = get_internal_minio_client()
        try:
            response = minio_client.get_object(
                bucket_name=file_obj.bucket,
                object_name=file_obj.storage_key,
            )
            pdf_bytes = response.read()
            response.close()
            response.release_conn()
        except Exception as e:
            raise ValueError(f"Failed to download PDF from storage: {str(e)}")

        # 8. Apply signature to PDF
        try:
            signed_pdf_bytes = self.pdf_service.apply_signature_to_pdf(
                pdf_bytes,
                page_number=field.page_number,
                x=field.x,
                y=field.y,
                width=field.width,
                height=field.height,
                signature_image_base64=signature_image_base64,
                typed_name=typed_name,
            )
        except Exception as e:
            raise ValueError(f"Failed to apply signature to PDF: {str(e)}")

        # 9. Upload signed PDF back to MinIO (replace original)
        try:
            minio_client.put_object(
                bucket_name=file_obj.bucket,
                object_name=file_obj.storage_key,
                data=io.BytesIO(signed_pdf_bytes),
                length=len(signed_pdf_bytes),
                content_type=file_obj.mime_type,
            )
        except Exception as e:
            raise ValueError(f"Failed to upload signed PDF: {str(e)}")

        # 10. Calculate document hash
        document_hash = self.pdf_service.calculate_pdf_hash(signed_pdf_bytes)

        # 11. Mark field as SIGNED
        await self.sig_repo.mark_signed(field_id)

        # 12. Check if all fields are signed
        pending_count = await self.sig_repo.count_pending_fields(file_obj.id)
        
        if pending_count == 0:
            # All fields signed - lock the file
            await self.file_repo.mark_locked(
                file_id=file_obj.id,
                document_hash=document_hash,
            )

        # 13. Return updated field
        updated_field = await self.sig_repo.get_by_id(field_id)
        return updated_field

    async def _enforce_sequential_signing(self, current_field: SignatureField) -> None:
        """
        Enforce sequential signing: all previous fields must be signed first.
        
        "Previous" means:
        - Earlier page number, OR
        - Same page but created earlier
        
        Args:
            current_field: The field being signed
        
        Raises:
            ValueError: If a previous field is still pending
        """
        # Get all fields for this file
        all_fields = await self.sig_repo.list_by_file(current_field.file_id)
        
        # Find fields that come before this one
        for field in all_fields:
            if field.id == current_field.id:
                continue
            
            # Check if this field comes before current_field
            is_earlier = (
                field.page_number < current_field.page_number
                or (
                    field.page_number == current_field.page_number
                    and field.created_at < current_field.created_at
                )
            )
            
            if is_earlier and field.status == SignatureFieldStatus.PENDING:
                raise ValueError(
                    f"Sequential signing required: Field on page {field.page_number} "
                    f"must be signed first"
                )


# Import required for MinIO operations
import io
