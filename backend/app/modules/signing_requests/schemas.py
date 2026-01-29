"""
SigningRequest Pydantic Schemas
"""

from uuid import UUID
from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, EmailStr


class RecipientCreate(BaseModel):
    """Recipient information for creating a signing request"""
    role: str = Field(..., description="Role name (e.g., 'Signer 1', 'Signer 2')")
    email: EmailStr = Field(..., description="Email address of the recipient")
    order_index: int = Field(..., ge=0, description="Order index for sequential signing")


class SigningRequestCreate(BaseModel):
    """Request to create a signing request from a template"""
    file_id: UUID = Field(..., description="UUID of template file")
    title: Optional[str] = Field(None, max_length=255, description="Optional title (defaults to filename)")
    signing_order: Literal["SEQUENTIAL", "PARALLEL"] = Field(
        default="SEQUENTIAL",
        description="Signing order: SEQUENTIAL (one after another) or PARALLEL (any order)"
    )
    recipients: List[RecipientCreate] = Field(
        ...,
        min_length=1,
        description="List of recipients with their roles and emails"
    )


class RecipientOut(BaseModel):
    """Recipient response schema"""
    id: UUID
    role: str
    email: str
    order_index: int
    status: str
    created_at: datetime
    sent_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class SigningRequestFieldOut(BaseModel):
    """Signing request field response schema"""
    id: UUID
    signing_request_id: UUID
    template_field_id: UUID
    recipient_id: UUID
    role: str
    field_type: str
    page: int
    x: float
    y: float
    width: float
    height: float
    value: Optional[str] = None
    status: str
    signed_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class SigningRequestListItem(BaseModel):
    """Signing request list item for dashboard/documents page"""
    id: UUID
    file_id: UUID
    title: str
    status: str
    signing_order: str
    created_at: datetime
    updated_at: datetime
    sent_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # File info
    filename: str
    file_status: str
    
    class Config:
        from_attributes = True


class SigningRequestDetail(BaseModel):
    """Detailed signing request response"""
    id: UUID
    file_id: UUID
    owner_id: UUID
    title: str
    status: str
    signing_order: str
    created_at: datetime
    updated_at: datetime
    sent_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # File metadata
    filename: str
    mime_type: str
    file_size: Optional[int] = None
    file_status: str
    storage_key: str
    
    # Recipients
    recipients: List[RecipientOut] = []
    
    # Signature fields count
    total_signature_fields: int
    signed_fields_count: int
    
    # All signed fields (for displaying signatures on PDF)
    fields: List[SigningRequestFieldOut] = []
    
    class Config:
        from_attributes = True


class SigningRequestStatsResponse(BaseModel):
    """Dashboard statistics response"""
    total: int
    draft: int
    sent: int
    in_progress: int
    completed: int


# Signer experience schemas (public, token-based)
class SignerContextResponse(BaseModel):
    """Signer context response (public, token-based)"""
    recipient: RecipientOut
    signing_request: dict  # Basic signing request info
    pdf_view_url: str
    fields: List[SigningRequestFieldOut]
    signing_order: str


class SignFieldRequest(BaseModel):
    """Request to sign a field"""
    signature_type: Literal["DRAW", "TYPED"]
    signature_image_base64: Optional[str] = None  # Required for DRAW
    typed_name: Optional[str] = None  # Required for TYPED


class SignFieldResponse(BaseModel):
    """Response after signing a field"""
    field: SigningRequestFieldOut
    all_fields_signed: bool  # True if all fields for this recipient are signed
