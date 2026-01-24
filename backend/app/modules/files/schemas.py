from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

# ---- Request/Response Schemas ----


class PresignRequest(BaseModel):
    """Request schema for presigned upload URL"""
    filename: str = Field(..., min_length=1, max_length=255, example="document.pdf")
    mime_type: str = Field(..., example="application/pdf")
    size: int = Field(..., gt=0, le=10485760, example=102400)  # Max 10MB


class PresignResponse(BaseModel):
    """Response schema with presigned upload URL"""
    file_id: str
    upload_url: str
    storage_key: str
    expires_in: int


class FileOut(BaseModel):
    """File metadata response"""
    id: UUID
    filename: str
    mime_type: str
    size: int | None
    status: str

    class Config:
        from_attributes = True


class FileListItem(BaseModel):
    """File list item for GET /api/v1/files"""
    id: UUID
    filename: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class SignatureFieldSummary(BaseModel):
    """Signature field summary for file details"""
    id: UUID
    page_number: int
    x: float
    y: float
    width: float
    height: float
    assigned_to: UUID
    status: str
    signature_type: Optional[str] = None
    signed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FileDetailOut(BaseModel):
    """Detailed file response with signature fields"""
    id: UUID
    filename: str
    mime_type: str
    size: Optional[int]
    status: str
    bucket: str
    storage_key: str
    document_hash: Optional[str] = None
    locked_at: Optional[datetime] = None
    created_at: datetime
    signature_fields: List[SignatureFieldSummary] = []

    class Config:
        from_attributes = True
