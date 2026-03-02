"""Pydantic schemas for public API request/response."""

from typing import Any, Generic, TypeVar
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, Field, EmailStr

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Standard envelope for all public API responses."""

    code: int = Field(0, description="0 = success, non-zero = error")
    message: str = Field("success", description="Human-readable message")
    data: T | None = Field(None, description="Response payload")

    @classmethod
    def success(cls, data: T | None = None, message: str = "success") -> "ApiResponse[T]":
        return cls(code=0, message=message, data=data)

    @classmethod
    def error(cls, message: str, code: int = 1, data: Any = None) -> "ApiResponse[None]":
        return cls(code=code, message=message, data=data)


# ---- API key management (JWT) ----

class ApiKeyCreate(BaseModel):
    """Request to create an API key."""

    name: str | None = Field(None, max_length=255)
    rate_limit_per_minute: int = Field(60, ge=1, le=1000)


class ApiKeyListItem(BaseModel):
    """API key in list (no secret)."""

    id: UUID
    key_prefix: str
    name: str | None
    rate_limit_per_minute: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Documents (API key) ----

class DocumentListItem(BaseModel):
    """Document in list."""

    id: UUID
    filename: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class PresignRequest(BaseModel):
    """Request for presigned upload URL."""

    filename: str = Field(..., min_length=1, max_length=255)
    mime_type: str = Field(..., example="application/pdf")


class PresignData(BaseModel):
    """Presign response data."""

    file_id: str
    upload_url: str
    storage_key: str
    expires_in: int


class DocumentDetailData(BaseModel):
    """Document detail with signature fields."""

    id: UUID
    filename: str
    mime_type: str
    size: int | None
    status: str
    signature_fields: list[dict] = []

    class Config:
        from_attributes = True


class DocumentUpdateRequest(BaseModel):
    """Update document (rename)."""

    filename: str = Field(..., min_length=1, max_length=255)


# ---- Templates (API key; template = document with optional signature fields) ----

class TemplateFieldCreate(BaseModel):
    """Add a signature field to a template. Role matches recipient when sending for signature."""

    page: int = Field(..., ge=1, description="Page number (1-based)")
    x: float = Field(..., description="X coordinate")
    y: float = Field(..., description="Y coordinate")
    width: float = Field(..., gt=0)
    height: float = Field(..., gt=0)
    field_type: str = Field(default="SIGNATURE", description="SIGNATURE, INITIAL, DATE, TEXT, EMAIL, FULLNAME, COMPANY")
    role: str | None = Field(None, description="Recipient role e.g. Signer 1, Signer 2 (for template)")


# ---- Signing requests (API key) ----

class RecipientCreate(BaseModel):
    """Recipient for signing request."""

    role: str
    email: EmailStr
    order_index: int = Field(..., ge=0)


class SigningRequestCreate(BaseModel):
    """Create signing request from template."""

    file_id: UUID
    title: str | None = None
    signing_order: str = "SEQUENTIAL"  # SEQUENTIAL | PARALLEL
    recipients: list[RecipientCreate]


class SigningRequestListItem(BaseModel):
    """Signing request in list."""

    id: UUID
    file_id: UUID
    title: str
    status: str
    signing_order: str
    created_at: datetime
    updated_at: datetime
    sent_at: datetime | None
    completed_at: datetime | None
    filename: str
    file_status: str

    class Config:
        from_attributes = True


class SigningRequestStats(BaseModel):
    """Counts by status."""

    total: int
    draft: int
    sent: int
    in_progress: int
    completed: int


# ---- User Management (API key; Zoho Sign–style) ----

class UserInviteRequest(BaseModel):
    """Invite a user (create account and send invite email)."""

    email: EmailStr
    name: str | None = Field(None, max_length=255)


class UserUpdateRequest(BaseModel):
    """Update user profile (name)."""

    name: str | None = Field(None, max_length=255)


class UserAccessUpdateRequest(BaseModel):
    """Update user access (enable/disable)."""

    enabled: bool = Field(..., description="True = active, False = disabled")


class UserRoleUpdateRequest(BaseModel):
    """Update user role."""

    role: str = Field(..., description="e.g. admin, member", max_length=64)
