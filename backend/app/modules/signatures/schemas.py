"""
Pydantic schemas for signature fields API
"""
from uuid import UUID
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator


class SignatureFieldCreate(BaseModel):
    """Request to create a new signature field"""
    file_id: UUID = Field(..., description="UUID of the document")
    page: int = Field(..., ge=1, description="Page number (1-based)")
    x: float = Field(..., description="X coordinate (PDF space)")
    y: float = Field(..., description="Y coordinate (PDF space)")
    width: float = Field(..., gt=0, description="Width in points")
    height: float = Field(..., gt=0, description="Height in points")
    assigned_to: UUID = Field(..., description="UUID of user who should sign (template owner for template fields)")
    field_type: str = Field(default="SIGNATURE", description="Field type: SIGNATURE, INITIAL, DATE, TEXT, EMAIL, FULLNAME, COMPANY, etc.")
    role: Optional[str] = Field(default=None, description="Recipient role for template: Me, Signer 1, Signer 2, etc.")

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


class SignatureSubmit(BaseModel):
    """Request to sign a signature field"""
    signature_type: Literal["DRAW", "UPLOAD", "TYPED"] = Field(
        ..., 
        description="Type of signature"
    )
    signature_image_base64: Optional[str] = Field(
        None,
        description="Base64-encoded image (for DRAW/UPLOAD types)"
    )
    typed_name: Optional[str] = Field(
        None,
        description="Name to render as typed signature (for TYPED type)"
    )

    @field_validator("signature_image_base64")
    @classmethod
    def validate_image_required(cls, v: Optional[str], info) -> Optional[str]:
        sig_type = info.data.get("signature_type")
        if sig_type in ["DRAW", "UPLOAD"] and not v:
            raise ValueError("signature_image_base64 required for DRAW/UPLOAD")
        return v

    @field_validator("typed_name")
    @classmethod
    def validate_name_required(cls, v: Optional[str], info) -> Optional[str]:
        sig_type = info.data.get("signature_type")
        if sig_type == "TYPED" and not v:
            raise ValueError("typed_name required for TYPED signature")
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
    field_type: str
    role: Optional[str] = None
    status: str
    signed_at: Optional[datetime]
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }
