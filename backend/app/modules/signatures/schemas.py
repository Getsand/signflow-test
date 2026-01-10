"""
Pydantic schemas for signature fields API
"""
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class SignatureFieldCreate(BaseModel):
    """Request to create a new signature field"""
    file_id: UUID = Field(..., description="UUID of the document")
    page: int = Field(..., ge=1, description="Page number (1-based)")
    x: float = Field(..., description="X coordinate (PDF space)")
    y: float = Field(..., description="Y coordinate (PDF space)")
    width: float = Field(..., gt=0, description="Width in points")
    height: float = Field(..., gt=0, description="Height in points")
    assigned_to: UUID = Field(..., description="UUID of user who should sign")

    @field_validator("width", "height")
    @classmethod
    def validate_positive_dimensions(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Width and height must be positive")
        return v

    @field_validator("page")
    @classmethod
    def validate_page_number(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Page number must be >= 1")
        return v


class SignatureFieldOut(BaseModel):
    """Response schema for signature field"""
    id: UUID
    file_id: UUID
    page_number: int
    x: float
    y: float
    width: float
    height: float
    assigned_to: UUID
    status: str
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }
