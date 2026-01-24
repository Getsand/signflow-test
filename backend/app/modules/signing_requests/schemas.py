"""
SigningRequest Pydantic Schemas
"""

from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class SigningRequestCreate(BaseModel):
    """Request to create a signing request from an existing file"""
    file_id: UUID = Field(..., description="UUID of uploaded file")
    title: Optional[str] = Field(None, max_length=255, description="Optional title (defaults to filename)")


class SigningRequestListItem(BaseModel):
    """Signing request list item for dashboard/documents page"""
    id: UUID
    file_id: UUID
    title: str
    status: str
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
    
    # Signature fields count
    total_signature_fields: int
    signed_fields_count: int
    
    class Config:
        from_attributes = True


class SigningRequestStatsResponse(BaseModel):
    """Dashboard statistics response"""
    total: int
    draft: int
    sent: int
    in_progress: int
    completed: int
