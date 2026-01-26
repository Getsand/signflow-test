"""
File service - Business logic for file uploads
"""

from uuid import uuid4, UUID

from minio.error import S3Error

from app.modules.files.repo import FileRepository
from app.modules.files.models import FileStatus
from app.core.storage import (
    get_internal_minio_client,
    generate_presigned_put_url,
    MINIO_BUCKET,
)

# ---- Upload Rules ----
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
}


class FileService:
    def __init__(self, repo: FileRepository):
        self.repo = repo
        self.minio = get_internal_minio_client()

    async def create_presigned_upload(
        self,
        *,
        filename: str,
        mime_type: str,
        owner_id: UUID,
    ) -> dict:
        """
        Generate presigned upload URL and create DB record.
        
        Returns:
            dict with file_id, upload_url, storage_key, expires_in
        """
        # ---- Generate storage path ----
        file_id = uuid4()
        storage_key = f"uploads/{file_id}/{filename}"

        # ---- Create DB record (UPLOADING status) ----
        # CRITICAL: Pass file_id to ensure storage_key matches database id
        file_obj = await self.repo.create_file(
            file_id=file_id,  # Use the same UUID for DB and storage path
            owner_id=owner_id,
            bucket=MINIO_BUCKET,  # REQUIRED: Must not be NULL
            filename=filename,
            storage_key=storage_key,
            mime_type=mime_type,
        )

        # ---- Generate presigned URL ----
        upload_url = generate_presigned_put_url(storage_key)

        return {
            "file_id": str(file_obj.id),
            "upload_url": upload_url,
            "storage_key": storage_key,
            "expires_in": 900,
        }

    async def finalize_upload(
        self, 
        *, 
        file_id: UUID, 
        owner_id: UUID
    ) -> dict:
        """
        Verify object exists in MinIO and mark as COMPLETED.
        """
        # ---- Check ownership ----
        file_obj = await self.repo.get_by_id(file_id=file_id, owner_id=owner_id)
        if not file_obj:
            raise ValueError("File not found or access denied")

        # ---- Check upload status ----
        if file_obj.status == FileStatus.COMPLETED:
            return file_obj
        
        if file_obj.status == FileStatus.FAILED:
            raise ValueError("Upload already failed")

        # ---- Verify object exists in MinIO ----
        try:
            stat = self.minio.stat_object(
                bucket_name=file_obj.bucket,
                object_name=file_obj.storage_key,
            )
        except S3Error:
            await self.repo.mark_failed(file_id=file_id)
            raise ValueError("File not found in storage")

        # ---- Mark as completed ----
        await self.repo.mark_completed(file_id=file_id, size=stat.size)
        
        # ---- Return updated object ----
        updated_obj = await self.repo.get_by_id(file_id=file_id, owner_id=owner_id)
        return updated_obj

    async def list_user_files(self, *, owner_id: UUID):
        """
        List all files owned by the current user.
        Returns files ordered by created_at DESC.
        """
        return await self.repo.list_user_files(owner_id=owner_id)

    async def get_file_details(self, *, file_id: UUID, owner_id: UUID):
        """
        Get file details with ownership check.
        Returns file object if user owns it, otherwise raises ValueError.
        """
        file_obj = await self.repo.get_by_id(file_id=file_id, owner_id=owner_id)
        if not file_obj:
            raise ValueError("File not found or access denied")
        return file_obj

    async def delete_file(
        self,
        *,
        file_id: UUID,
        owner_id: UUID,
    ) -> None:
        """
        Delete a file from both MinIO storage and database.
        
        Only the owner can delete their files.
        Raises ValueError if file not found or access denied.
        """
        import logging
        logger = logging.getLogger(__name__)
        
        # ---- Check ownership and get file details ----
        file_obj = await self.repo.get_by_id(file_id=file_id, owner_id=owner_id)
        if not file_obj:
            raise ValueError("File not found or access denied")
        
        # ---- Delete from MinIO storage ----
        try:
            self.minio.remove_object(
                bucket_name=file_obj.bucket,
                object_name=file_obj.storage_key,
            )
            logger.info(f"Deleted file from MinIO: {file_obj.storage_key}")
        except S3Error as e:
            # Log but don't fail - file might not exist in storage
            logger.warning(f"Failed to delete file from MinIO: {e}")
        
        # ---- Delete from database ----
        deleted = await self.repo.delete_file(
            file_id=file_id,
            owner_id=owner_id,
        )
        
        if not deleted:
            raise ValueError("File not found or access denied")
        
        logger.info(f"Deleted file record from database: {file_id}")