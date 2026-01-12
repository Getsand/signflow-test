from typing import Optional
from uuid import UUID
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.files.models import FileObject, FileStatus


class FileRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_file(
        self,
        *,
        owner_id: UUID,
        bucket: str,
        storage_key: str,
        filename: str,
        mime_type: str,
    ) -> FileObject:
        """
        Create a new file record in UPLOADING state.
        Size is unknown at this stage.
        """
        file_obj = FileObject(
            owner_id=owner_id,
            bucket=bucket,
            storage_key=storage_key,
            filename=filename,
            mime_type=mime_type,
            size=None,
            status=FileStatus.UPLOADING,
        )

        self.session.add(file_obj)
        await self.session.flush()     # assign PK
        await self.session.refresh(file_obj)

        return file_obj

    async def get_by_id(
        self,
        *,
        file_id: UUID,
        owner_id: UUID,
    ) -> Optional[FileObject]:
        """
        Fetch file by ID with ownership check.
        """
        stmt = (
            select(FileObject)
            .where(
                FileObject.id == file_id,
                FileObject.owner_id == owner_id,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def mark_completed(
        self,
        *,
        file_id: UUID,
        size: int,
    ) -> None:
        """
        Mark upload as completed.
        Idempotent: only updates if currently UPLOADING.
        """
        stmt = (
            update(FileObject)
            .where(
                FileObject.id == file_id,
                FileObject.status == FileStatus.UPLOADING,
            )
            .values(
                status=FileStatus.COMPLETED,
                size=size,
            )
        )
        await self.session.execute(stmt)

    async def mark_failed(
        self,
        *,
        file_id: UUID,
    ) -> None:
        """
        Mark upload as failed.
        Safe to call multiple times.
        """
        stmt = (
            update(FileObject)
            .where(FileObject.id == file_id)
            .values(status=FileStatus.FAILED)
        )
        await self.session.execute(stmt)

    async def mark_locked(
        self,
        *,
        file_id: UUID,
        document_hash: str,
    ) -> None:
        """
        Mark file as LOCKED (all signatures complete).
        Sets locked_at timestamp and document hash.
        """
        stmt = (
            update(FileObject)
            .where(FileObject.id == file_id)
            .values(
                status=FileStatus.LOCKED,
                locked_at=datetime.utcnow(),
                document_hash=document_hash,
            )
        )
        await self.session.execute(stmt)

    async def get_by_id_no_ownership_check(
        self,
        file_id: UUID,
    ) -> Optional[FileObject]:
        """
        Fetch file by ID WITHOUT ownership check.
        Used for internal operations like signing.
        """
        stmt = select(FileObject).where(FileObject.id == file_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
