"""
Public API: signature fields (boxes) on documents.

Wrapper hides backend user IDs. External clients only send geometry + role.
Wrapper uses its own backend service user as `assigned_to`.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.backend_client import BackendClient
from app.deps import require_api_key
from app.models import ApiKey

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/signatures", tags=["Public API – Signatures"])


def get_backend(request: Request) -> BackendClient:
    return request.app.state.backend_client


class SignatureFieldCreatePublic(BaseModel):
    """Public request to create a signature field (no backend user_id required)."""

    file_id: str = Field(..., description="UUID of the template file (template_id)")
    page: int = Field(..., ge=1, description="Page number (1-based)")
    x: float
    y: float
    width: float = Field(..., gt=0)
    height: float = Field(..., gt=0)
    field_type: str = Field("SIGNATURE", description="SIGNATURE, INITIAL, etc.")
    role: Optional[str] = Field(
        default=None, description="Recipient role: e.g. 'Signer 1', 'Signer 2'"
    )


@router.post(
    "/fields",
    status_code=status.HTTP_201_CREATED,
)
async def create_signature_field(
    request: Request,
    body: SignatureFieldCreatePublic,
    _: ApiKey = Depends(require_api_key),
    backend: BackendClient = Depends(get_backend),
):
    """
    Create a signature field (box) on a template via backend /api/v1/signatures/fields.

    - Clients provide file_id (template_id from upload), coordinates, and role.
    - Wrapper resolves its own backend service user and uses that as `assigned_to`.
    """
    # Get backend service user id (owner) via /api/v1/auth/me
    me_resp = await backend.get("/api/v1/auth/me")
    if me_resp.status_code != 200:
        raise HTTPException(
            status_code=me_resp.status_code,
            detail=me_resp.text or "Failed to resolve backend service user",
        )
    me = me_resp.json()
    owner_id = me.get("id")
    if not owner_id:
        raise HTTPException(
            status_code=500,
            detail="Backend /me did not return user id",
        )

    payload = {
        "file_id": body.file_id,
        "page": body.page,
        "x": body.x,
        "y": body.y,
        "width": body.width,
        "height": body.height,
        "assigned_to": owner_id,
        "field_type": body.field_type,
        "role": body.role,
    }

    r = await backend.post("/api/v1/signatures/fields", json=payload)
    if r.status_code not in (200, 201):
        # Surface backend error to client
        try:
            detail = r.json()
        except Exception:
            detail = r.text or "Backend error"
        raise HTTPException(status_code=r.status_code, detail=detail)
    return r.json()


@router.get("/fields")
async def list_signature_fields(
    request: Request,
    file_id: str = Query(..., description="UUID of the file (template/document)"),
    _: ApiKey = Depends(require_api_key),
    backend: BackendClient = Depends(get_backend),
):
    """
    List all signature fields for a file, via backend /api/v1/signatures/fields.
    """
    r = await backend.get("/api/v1/signatures/fields", params={"file_id": file_id})
    if r.status_code != 200:
        try:
            detail = r.json()
        except Exception:
            detail = r.text or "Backend error"
        raise HTTPException(status_code=r.status_code, detail=detail)
    return r.json()

