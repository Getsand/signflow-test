"""
SigningRequest Model

Represents a document workflow instance with status lifecycle.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.db import Base


class SigningRequestStatus(str, enum.Enum):
    """
    Signing request status lifecycle.
    
    DRAFT: Created but not sent to signers
    SENT: Sent to signers, awaiting signatures
    IN_PROGRESS: At least one signature added
    COMPLETED: All signatures added, document locked
    """
    DRAFT = "DRAFT"
    SENT = "SENT"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class SigningRequest(Base):
    """
    SigningRequest - Document workflow wrapper
    
    Wraps a file with workflow state and metadata.
    One-to-one relationship with FileObject.
    """
    __tablename__ = "signing_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Link to file
    file_id = Column(
        UUID(as_uuid=True),
        ForeignKey("file_objects.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # One signing request per file
        index=True,
    )
    
    # Owner (document creator)
    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # Workflow state
    status = Column(
        SQLEnum(SigningRequestStatus, name="signingrequeststatus"),
        nullable=False,
        default=SigningRequestStatus.DRAFT,
        index=True,
    )
    
    # Metadata
    title = Column(String(255), nullable=True)  # Optional, defaults to filename
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    sent_at = Column(DateTime, nullable=True)  # When SENT
    completed_at = Column(DateTime, nullable=True)  # When COMPLETED
    
    # Relationships
    file = relationship("FileObject", backref="signing_request", uselist=False)
    owner = relationship("User", backref="signing_requests")

    def __repr__(self):
        return f"<SigningRequest {self.id} {self.status.value}>"
