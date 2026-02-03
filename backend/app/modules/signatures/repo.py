"""
Repository for signature fields - pure database operations
"""
import uuid as uuid_lib
from typing import List, Optional, Union
from uuid import UUID
from datetime import datetime

from sqlalchemy import select, delete, update, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.signatures.models import SignatureField, SignatureFieldStatus


class _SignatureFieldRow:
    """Row-like object for list_by_file when role column is missing (pre-migration)."""
    __slots__ = ("id", "file_id", "page_number", "x", "y", "width", "height", "assigned_to", "field_type", "status", "signed_at", "created_at", "role")
    def __init__(self, id, file_id, page_number, x, y, width, height, assigned_to, field_type, status, signed_at, created_at):
        self.id = id
        self.file_id = file_id
        self.page_number = page_number
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.assigned_to = assigned_to
        self.field_type = field_type
        self.status = status
        self.signed_at = signed_at
        self.created_at = created_at
        self.role = None


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
        field_type: str = "SIGNATURE",
        role: Optional[str] = None,
    ) -> Union[SignatureField, _SignatureFieldRow]:
        """
        Create a new signature field in PENDING status.
        Uses ORM when possible; falls back to raw INSERT if role column is missing (pre-migration).
        """
        field = SignatureField(
            file_id=file_id,
            page_number=page_number,
            x=x,
            y=y,
            width=width,
            height=height,
            assigned_to=assigned_to,
            field_type=field_type,
            role=role,
            status=SignatureFieldStatus.PENDING,
        )

        self.session.add(field)
        try:
            await self.session.flush()
            await self.session.refresh(field)
            return field
        except ProgrammingError as e:
            if "role" not in str(e).lower():
                raise
            # Table has no role column (migration not run) — insert without role
            await self.session.rollback()
            new_id = uuid_lib.uuid4()
            stmt = text(
                "INSERT INTO signature_fields (id, file_id, page_number, x, y, width, height, assigned_to, field_type, status, created_at) "
                "VALUES (:id, :file_id, :page_number, :x, :y, :width, :height, :assigned_to, :field_type, 'PENDING'::signaturefieldstatus, now()) "
                "RETURNING id, file_id, page_number, x, y, width, height, assigned_to, field_type, status, signed_at, created_at"
            )
            r = await self.session.execute(stmt, {
                "id": str(new_id),
                "file_id": str(file_id),
                "page_number": page_number,
                "x": x, "y": y, "width": width, "height": height,
                "assigned_to": str(assigned_to),
                "field_type": field_type,
            })
            row = r.fetchone()
            if not row:
                raise RuntimeError("Insert succeeded but RETURNING gave no row")
            status_val = row[9]
            status_str = getattr(status_val, "value", status_val) if status_val is not None else "PENDING"
            return _SignatureFieldRow(
                id=row[0], file_id=row[1], page_number=row[2], x=row[3], y=row[4],
                width=row[5], height=row[6], assigned_to=row[7], field_type=row[8],
                status=status_str, signed_at=row[10], created_at=row[11],
            )

    async def get_by_id(self, field_id: UUID) -> Optional[Union[SignatureField, _SignatureFieldRow]]:
        """Fetch signature field by ID. Uses raw SQL without role column so it works before/after role migration."""
        stmt = text(
            "SELECT id, file_id, page_number, x, y, width, height, assigned_to, field_type, status, signed_at, created_at "
            "FROM signature_fields WHERE id = :fid"
        )
        r = await self.session.execute(stmt, {"fid": str(field_id)})
        row = r.fetchone()
        if not row:
            return None
        status_val = row[9]
        status_str = getattr(status_val, "value", status_val) if status_val is not None else "PENDING"
        return _SignatureFieldRow(
            id=row[0], file_id=row[1], page_number=row[2], x=row[3], y=row[4],
            width=row[5], height=row[6], assigned_to=row[7], field_type=row[8],
            status=status_str, signed_at=row[10], created_at=row[11],
        )

    async def list_by_file(self, file_id: UUID) -> List[Union[SignatureField, _SignatureFieldRow]]:
        """Get all signature fields for a file. Uses raw SQL without role column to avoid transaction/async issues when role column is missing."""
        return await self._list_by_file_raw(file_id)

    async def _list_by_file_raw(self, file_id: UUID) -> List[_SignatureFieldRow]:
        """Raw query without role column (works before and after migration; role is always None here)."""
        fallback = text(
            "SELECT id, file_id, page_number, x, y, width, height, assigned_to, field_type, status, signed_at, created_at "
            "FROM signature_fields WHERE file_id = :fid ORDER BY page_number, created_at"
        )
        r = await self.session.execute(fallback, {"fid": str(file_id)})
        rows = r.fetchall()
        def _status_str(s):
            return getattr(s, "value", s) if s is not None else "PENDING"

        return [
            _SignatureFieldRow(
                id=row[0], file_id=row[1], page_number=row[2], x=row[3], y=row[4],
                width=row[5], height=row[6], assigned_to=row[7], field_type=row[8],
                status=_status_str(row[9]), signed_at=row[10], created_at=row[11],
            )
            for row in rows
        ]

    async def delete(self, field_id: UUID) -> bool:
        """
        Delete a signature field.
        Returns True if deleted, False if not found.
        """
        stmt = delete(SignatureField).where(SignatureField.id == field_id)
        result = await self.session.execute(stmt)
        return result.rowcount > 0

    async def mark_signed(self, field_id: UUID) -> None:
        """
        Mark a signature field as SIGNED with timestamp.
        """
        stmt = (
            update(SignatureField)
            .where(SignatureField.id == field_id)
            .values(
                status=SignatureFieldStatus.SIGNED,
                signed_at=datetime.utcnow(),
            )
        )
        await self.session.execute(stmt)

    async def count_pending_fields(self, file_id: UUID) -> int:
        """Count how many PENDING signature fields remain for a file (raw query, no role column)."""
        stmt = text(
            "SELECT COUNT(*) FROM signature_fields WHERE file_id = :fid AND status = 'PENDING'"
        )
        r = await self.session.execute(stmt, {"fid": str(file_id)})
        return r.scalar() or 0
