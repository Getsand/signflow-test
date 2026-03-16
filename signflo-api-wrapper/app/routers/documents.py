"""
Public API: documents (envelopes) and templates. Proxies to SignFlo backend with service JWT.
"""
from __future__ import annotations

import io
import logging
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from typing import List, Optional
from pydantic import BaseModel, Field, HttpUrl

from app.backend_client import BackendClient
from app.deps import require_api_key
from app.models import ApiKey

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Public API – Documents"])


def get_backend(request: Request) -> BackendClient:
    return request.app.state.backend_client


# --- Schemas (public API) ---
class CreateDocumentBody(BaseModel):
    """Create a document (template) from a URL. Returns template_id for use in send."""
    document_url: HttpUrl = Field(..., description="URL of the PDF document")
    filename: Optional[str] = Field(None, max_length=255, description="Optional filename (default from URL)")


class RecipientItem(BaseModel):
    role: str = Field(..., min_length=1)
    email: str = Field(..., min_length=1)
    order_index: int = Field(0, ge=0)


class SendDocumentBody(BaseModel):
    """Send a document for signature (create envelope and send)."""
    template_id: str = Field(..., description="ID from create document (file_id)")
    title: Optional[str] = None
    signing_order: str = Field("SEQUENTIAL", pattern="^(SEQUENTIAL|PARALLEL)$")
    recipients: List[RecipientItem] = Field(..., min_length=1)


# --- Documents (envelopes = signing requests) ---
@router.get("/documents")
async def list_documents(
    request: Request,
    _: ApiKey = Depends(require_api_key),
    backend: BackendClient = Depends(get_backend),
):
    """List all documents (signing requests/envelopes)."""
    r = await backend.get("/api/v1/signing-requests")
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=r.text or "Backend error")
    return r.json()


@router.get("/documents/{document_id}")
async def get_document(
    document_id: UUID,
    request: Request,
    _: ApiKey = Depends(require_api_key),
    backend: BackendClient = Depends(get_backend),
):
    """Get one document (envelope) by ID."""
    r = await backend.get(f"/api/v1/signing-requests/{document_id}")
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=r.text or "Backend error")
    return r.json()


@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: UUID,
    request: Request,
    _: ApiKey = Depends(require_api_key),
    backend: BackendClient = Depends(get_backend),
):
    """Download signed PDF for a document (envelope)."""
    r = await backend.get(f"/api/v1/signing-requests/{document_id}/download")
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=r.text or "Backend error")
    return StreamingResponse(
        io.BytesIO(r.content),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=document_{document_id}.pdf"},
    )


# --- Create document (template) from URL ---
@router.post("/documents/upload-from-url", status_code=status.HTTP_201_CREATED)
async def create_document_from_url(
    request: Request,
    body: CreateDocumentBody,
    _: ApiKey = Depends(require_api_key),
    backend: BackendClient = Depends(get_backend),
):
    """
    Create a document (template) by fetching PDF from URL.
    Returns template_id to use in send document.
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(str(body.document_url))
            resp.raise_for_status()
            content = resp.content
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch document URL: {e}",
        )
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large (max 10MB)")
    filename = body.filename or "document.pdf"
    if not filename.lower().endswith(".pdf"):
        filename = filename + ".pdf" if not filename.endswith(".pdf") else filename

    # Presign
    presign_r = await backend.post(
        "/api/v1/files/presign",
        json={"filename": filename, "mime_type": "application/pdf", "size": len(content)},
    )
    if presign_r.status_code != 200:
        raise HTTPException(status_code=presign_r.status_code, detail=presign_r.text or "Presign failed")
    presign = presign_r.json()
    file_id = presign["file_id"]
    upload_url = presign["upload_url"]

    # Upload to presigned URL (no auth)
    put_r = await httpx.AsyncClient().put(upload_url, content=content)
    if put_r.status_code not in (200, 204):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Upload to storage failed",
        )

    # Finalize
    final_r = await backend.post(f"/api/v1/files/{file_id}/finalize")
    if final_r.status_code != 200:
        raise HTTPException(status_code=final_r.status_code, detail=final_r.text or "Finalize failed")
    out = final_r.json()
    return {"template_id": out["id"], "filename": out.get("filename", filename)}


# --- Send document (create envelope + send) ---
@router.post("/documents/send", status_code=status.HTTP_201_CREATED)
async def send_document(
    request: Request,
    body: SendDocumentBody,
    _: ApiKey = Depends(require_api_key),
    backend: BackendClient = Depends(get_backend),
):
    """Create a signing request from a template and send to recipients. Returns document_id (envelope id)."""
    try:
        file_uuid = UUID(body.template_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid template_id")
    recipients = [{"role": r.role, "email": r.email, "order_index": r.order_index} for r in body.recipients]
    create_r = await backend.post(
        "/api/v1/signing-requests",
        json={
            "file_id": str(file_uuid),
            "title": body.title,
            "signing_order": body.signing_order,
            "recipients": recipients,
        },
    )
    if create_r.status_code not in (200, 201):
        raise HTTPException(status_code=create_r.status_code, detail=create_r.text or "Create failed")
    sr = create_r.json()
    request_id = sr["id"]

    send_r = await backend.post(f"/api/v1/signing-requests/{request_id}/send")
    if send_r.status_code != 200:
        # Backend sometimes returns 400 \"Cannot send from SENT status\" even when email was actually sent.
        # Treat that specific case as a soft success for API consumers.
        raw = send_r.text or ""
        if "Cannot send from SENT status" in raw:
            return {
                "document_id": request_id,
                "status": "SENT",
                "sent": True,
                "failed_recipients": [],
                "warning": "Backend reported 'Cannot send from SENT status' but request was already SENT.",
            }
        raise HTTPException(status_code=send_r.status_code, detail=raw or "Send failed")
    send_data = send_r.json()
    return {
        "document_id": request_id,
        "status": send_data.get("signing_request", {}).get("status", "SENT"),
        "sent": send_data.get("sent", False),
        "failed_recipients": send_data.get("failed_recipients", []),
    }
