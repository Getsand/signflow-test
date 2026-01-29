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
    Text,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Float,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.base import Base


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


class SigningOrder(str, enum.Enum):
    """Signing order type"""
    SEQUENTIAL = "SEQUENTIAL"  # Signers sign one after another
    PARALLEL = "PARALLEL"      # Signers can sign in any order


class RecipientStatus(str, enum.Enum):
    """Recipient signing status"""
    PENDING = "PENDING"  # Not yet signed
    SIGNED = "SIGNED"    # Has signed


class SigningRequest(Base):
    """
    SigningRequest - Document workflow wrapper
    
    Wraps a file (template) with workflow state and metadata.
    One-to-one relationship with FileObject.
    """
    __tablename__ = "signing_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Link to file (template)
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
    
    # Signing order
    signing_order = Column(
        SQLEnum(SigningOrder, name="signingorder"),
        nullable=False,
        default=SigningOrder.SEQUENTIAL,
    )
    
    # Metadata
    title = Column(String(255), nullable=True)  # Optional, defaults to filename
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    sent_at = Column(DateTime, nullable=True)  # When SENT
    completed_at = Column(DateTime, nullable=True)  # When COMPLETED
    
    # Relationships
    file = Column  # type: ignore[assignment]  # placeholder for type checkers
    file = relationship("FileObject", backref="signing_request", uselist=False)
    owner = relationship("User", backref="signing_requests")
    recipients = relationship(
        "SigningRequestRecipient",
        back_populates="signing_request",
        cascade="all, delete-orphan",
    )
    fields = relationship(
        "SigningRequestField",
        back_populates="signing_request",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<SigningRequest {self.id} {self.status.value}>"


class SigningRequestRecipient(Base):
    """
    SigningRequestRecipient - Maps roles to email addresses
    
    Links signature field roles (e.g., "Signer 1", "Signer 2") to email addresses
    for sending signing requests.
    """
    __tablename__ = "signing_request_recipients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Link to signing request
    signing_request_id = Column(
        UUID(as_uuid=True),
        ForeignKey("signing_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # Role name (e.g., "Signer 1", "Signer 2")
    role = Column(String(50), nullable=False)
    
    # Email address
    email = Column(String(255), nullable=False)
    
    # Order index (for sequential signing)
    order_index = Column(Integer, nullable=False, default=0)
    
    # Status
    status = Column(
        SQLEnum(RecipientStatus, name="recipientstatus"),
        nullable=False,
        default=RecipientStatus.PENDING,
    )
    
    # Signing token (unique token for signing link)
    signing_token = Column(String(64), nullable=True, unique=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    sent_at = Column(DateTime, nullable=True)  # When email was sent
    
    # Relationships
    signing_request = relationship("SigningRequest", back_populates="recipients")
    fields = relationship(
        "SigningRequestField",
        back_populates="recipient",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<SigningRequestRecipient {self.id} {self.role} {self.email} {self.status.value}>"


class SigningRequestFieldStatus(str, enum.Enum):
    """Signing request field status"""
    PENDING = "PENDING"
    SIGNED = "SIGNED"


class SigningRequestField(Base):
    """
    SigningRequestField - Concrete signing field for a specific signing request.
    
    These fields are copied from template signature fields when a signing request
    is created. They are immutable with respect to the template and will be used
    later during the signing process.
    """

    __tablename__ = "signing_request_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Link to signing request
    signing_request_id = Column(
        UUID(as_uuid=True),
        ForeignKey("signing_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Link back to the template signature field
    template_field_id = Column(
        UUID(as_uuid=True),
        ForeignKey("signature_fields.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Recipient this field is assigned to
    recipient_id = Column(
        UUID(as_uuid=True),
        ForeignKey("signing_request_recipients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Role name (e.g., "Signer 1", "Signer 2") - duplicated for convenience
    role = Column(String(50), nullable=False)

    # Field type (SIGNATURE, INITIAL, TEXT, DATE, etc.)
    field_type = Column(String(50), nullable=False, default="SIGNATURE")

    # Page number (1-based)
    page = Column(Integer, nullable=False)

    # Position and size (PDF coordinates)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    width = Column(Float, nullable=False)
    height = Column(Float, nullable=False)

    # Value captured during signing (e.g., signature, text)
    # Using Text() instead of String() to support base64-encoded signature images
    value = Column(Text(), nullable=True)

    # Status and timestamps
    status = Column(
        SQLEnum(SigningRequestFieldStatus, name="signingrequestfieldstatus"),
        nullable=False,
        default=SigningRequestFieldStatus.PENDING,
        index=True,
    )
    signed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    signing_request = relationship("SigningRequest", back_populates="fields")
    recipient = relationship("SigningRequestRecipient", back_populates="fields")

    def __repr__(self) -> str:
        return (
            f"<SigningRequestField id={self.id} "
            f"request={self.signing_request_id} page={self.page} "
            f"role={self.role} status={self.status}>"
        )
