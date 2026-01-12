"""
Signature Fields Models

Represents signature placeholders on documents.
This is pure metadata - no PDF manipulation in this milestone.
"""
import uuid
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, Float, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.base import Base


class SignatureFieldStatus(str, enum.Enum):
    """Status of a signature field"""
    PENDING = "PENDING"  # Awaiting signature
    SIGNED = "SIGNED"    # Already signed


class SignatureField(Base):
    """
    Signature field (box) on a document.
    
    Represents a rectangular area where a signature is expected.
    - Position is in PDF coordinate space (bottom-left origin)
    - No file mutation in this milestone - pure metadata
    - Cascade delete: if file is deleted, fields are deleted
    """
    __tablename__ = "signature_fields"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )

    # File reference (CASCADE DELETE)
    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("file_objects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Page number (1-based indexing)
    page_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # Position and size (PDF coordinates)
    x: Mapped[float] = mapped_column(Float, nullable=False)
    y: Mapped[float] = mapped_column(Float, nullable=False)
    width: Mapped[float] = mapped_column(Float, nullable=False)
    height: Mapped[float] = mapped_column(Float, nullable=False)

    # Assigned signer
    assigned_to: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Status
    status: Mapped[SignatureFieldStatus] = mapped_column(
        Enum(SignatureFieldStatus, name='signaturefieldstatus'),
        nullable=False,
        default=SignatureFieldStatus.PENDING,
    )

    # Timestamp when signed (NULL if still pending)
    signed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<SignatureField id={self.id} file={self.file_id} page={self.page_number} status={self.status}>"
