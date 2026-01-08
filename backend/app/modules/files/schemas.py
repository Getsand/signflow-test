from uuid import UUID
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
