"""
File storage models for SignFlow
"""
import uuid
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from typing import Optional
from app.core.base import Base

import enum

class FileStatus(str, enum.Enum):
    UPLOADING = "UPLOADING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    LOCKED = "LOCKED"  # File is signed and locked
class FileObject(Base):
    __tablename__ = "file_objects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    bucket: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    storage_key: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        unique=True,
        index=True,
    )

    mime_type: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    size: Mapped[Optional[int]] = mapped_column(
    Integer,
    nullable=True,
    )

    status: Mapped[FileStatus] = mapped_column(
        Enum(FileStatus),
        nullable=False,
        default=FileStatus.UPLOADING,
    )

    # SHA-256 hash of final signed PDF
    document_hash: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
    )

    # Timestamp when file was locked (all signatures complete)
    locked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<FileObject id={self.id} key={self.storage_key} status={self.status}>"
