from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.files.models import FileObject


class FileRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_storage_key(self, storage_key: str) -> Optional[FileObject]:
        result = await self.session.execute(
            select(FileObject).where(FileObject.storage_key == storage_key)
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        owner_id: UUID,
        filename: str,
        storage_key: str,
        mime_type: str,
        size: int,
    ) -> FileObject:
        file_obj = FileObject(
            owner_id=owner_id,
            filename=filename,
            storage_key=storage_key,
            mime_type=mime_type,
            size=size,
        )

        self.session.add(file_obj)
        await self.session.flush()      # get PK
        await self.session.refresh(file_obj)

        return file_obj
