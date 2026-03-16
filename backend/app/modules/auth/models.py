"""
Authentication models for SignFlo
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.base import Base


class User(Base):
    """
    User model for authentication and profile management
    
    Supports both email/password and Google OAuth authentication.
    """
    
    __tablename__ = "users"
    
    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False
    )
    
    # Email authentication
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )
    
    # Profile
    name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    
    # Password (for email/password auth)
    password_hash: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    
    # Google OAuth
    google_sub: Mapped[Optional[str]] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
        index=True
    )
    
    # Verification status
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        server_default="false"
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"

