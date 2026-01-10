"""
Repository for signature fields - pure database operations
"""
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.signatures.models import SignatureField, SignatureFieldStatus


class SignatureFieldRepository:
    """Database operations for signature fields"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        *,
        file_id: UUID,
        page_number: int,
        x: float,
        y: float,
        width: float,
        height: float,
        assigned_to: UUID,
    ) -> SignatureField:
        """
        Create a new signature field in PENDING status.
        """
        field = SignatureField(
            file_id=file_id,
            page_number=page_number,
            x=x,
            y=y,
            width=width,
            height=height,
            assigned_to=assigned_to,
            status=SignatureFieldStatus.PENDING,
        )

        self.session.add(field)
        await self.session.flush()
        await self.session.refresh(field)

        return field

    async def get_by_id(self, field_id: UUID) -> Optional[SignatureField]:
        """Fetch signature field by ID"""
        stmt = select(SignatureField).where(SignatureField.id == field_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_file(self, file_id: UUID) -> List[SignatureField]:
        """Get all signature fields for a file"""
        stmt = (
            select(SignatureField)
            .where(SignatureField.file_id == file_id)
            .order_by(SignatureField.page_number, SignatureField.created_at)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def delete(self, field_id: UUID) -> bool:
        """
        Delete a signature field.
        Returns True if deleted, False if not found.
        """
        stmt = delete(SignatureField).where(SignatureField.id == field_id)
        result = await self.session.execute(stmt)
        return result.rowcount > 0
