from __future__ import annotations

import io
import json
import os
from typing import Any, Dict, List, Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse

from app.backend_client import BackendClient

from adapters.zoho_adapter import convert_create_request_payload, map_status
from api.zoho.auth import ZohoAPIError, require_zoho_oauthtoken


router = APIRouter(tags=["Zoho Sign Compatible – Templates"])


def _get_backend(request: Request) -> BackendClient:
    return request.app.state.backend_client


async def _upload_file_and_create_template(
    *,
    backend: BackendClient,
    file: UploadFile,
    filename: Optional[str],
) -> str:
    content = await file.read()
    if not content:
        raise ZohoAPIError(
            code=400,
            message=(
                "Uploaded PDF is empty (0 bytes). In Postman: Body → form-data → file → Select File again."
            ),
            status_code=400,
        )
    if len(content) > 10 * 1024 * 1024:
        raise ZohoAPIError(code=413, message="File too large (max 10MB)", status_code=413)

    mime_type = file.content_type or "application/pdf"
    out_filename = filename or file.filename or "template.pdf"
    if not out_filename.lower().endswith(".pdf"):
        out_filename = out_filename + ".pdf"

    presign_r = await backend.post(
        "/api/v1/files/presign",
        json={"filename": out_filename, "mime_type": mime_type, "size": len(content)},
    )
    if presign_r.status_code != 200:
        raise ZohoAPIError(
            code=presign_r.status_code,
            message=presign_r.text or "Failed to presign upload",
            status_code=presign_r.status_code,
        )

    presign = presign_r.json()
    file_id = presign["file_id"]
    upload_url = presign["upload_url"]

    put_r = await httpx.AsyncClient().put(upload_url, content=content)
    if put_r.status_code not in (200, 204):
        raise ZohoAPIError(code=502, message="Upload to storage failed", status_code=502)

    finalize_r = await backend.post(f"/api/v1/files/{file_id}/finalize")
    if finalize_r.status_code not in (200, 201):
        raise ZohoAPIError(
            code=finalize_r.status_code,
            message=finalize_r.text or "Finalize failed",
            status_code=finalize_r.status_code,
        )

    finalized = finalize_r.json()
    return str(finalized.get("id") or file_id)


@router.post("/api/v1/templates", response_class=JSONResponse)
async def create_template(
    request: Request,
    file: UploadFile = File(...),
    template_name: Optional[str] = Form(None),
    _: str = Depends(require_zoho_oauthtoken),
):
    backend = _get_backend(request)
    try:
        filename = template_name or file.filename or "template.pdf"
        template_id = await _upload_file_and_create_template(backend=backend, file=file, filename=filename)
        return JSONResponse(
            content={
                "code": 0,
                "templates": {"template_id": template_id, "template_status": "completed"},
                "message": "Template created successfully",
            },
            status_code=200,
        )
    except ZohoAPIError:
        raise
    except Exception as e:
        raise ZohoAPIError(code=500, message=str(e), status_code=500)


@router.get("/api/v1/templates", response_class=JSONResponse)
async def list_templates(
    request: Request,
    _: str = Depends(require_zoho_oauthtoken),
):
    backend = _get_backend(request)
    try:
        r = await backend.get("/api/v1/files")
        if r.status_code != 200:
            raise ZohoAPIError(code=r.status_code, message=r.text or "Failed to list templates", status_code=r.status_code)

        files = r.json() or []
        completed = [f for f in files if str(f.get("status") or "").upper() == "COMPLETED"]

        mapped = []
        for f in completed:
            mapped.append(
                {
                    "template_id": str(f.get("id")),
                    "template_status": "completed",
                    "filename": f.get("filename"),
                    "created_at": f.get("created_at"),
                }
            )

        return JSONResponse(content={"code": 0, "templates": mapped}, status_code=200)
    except ZohoAPIError:
        raise
    except Exception as e:
        raise ZohoAPIError(code=500, message=str(e), status_code=500)


@router.post("/api/v1/templates/{template_id}/create_request", response_class=JSONResponse)
async def create_request_from_template(
    request: Request,
    template_id: str,
    _: str = Depends(require_zoho_oauthtoken),
):
    """
    Zoho-compatible create_request from template.

    Zoho payload varies; we accept either:
      - { "requests": {...} }
      - { ... } (treated as requests payload)
    """
    backend = _get_backend(request)
    try:
        _ = UUID(template_id)
        # FastAPI won't parse body into `payload` without Body(). We'll read raw JSON.
        body = await request.json()
        if isinstance(body, dict) and "requests" in body and isinstance(body.get("requests"), dict):
            requests_payload = body["requests"]
        else:
            requests_payload = body if isinstance(body, dict) else {}

        internal = convert_create_request_payload(requests_payload)

        create_r = await backend.post(
            "/api/v1/signing-requests",
            json={
                "file_id": template_id,
                "title": internal.get("title"),
                "signing_order": internal.get("signing_order", "SEQUENTIAL"),
                "recipients": internal.get("recipients", []),
            },
        )
        if create_r.status_code not in (200, 201):
            raise ZohoAPIError(
                code=create_r.status_code,
                message=create_r.text or "Failed to create signing request",
                status_code=create_r.status_code,
            )

        created = create_r.json()
        request_id = str(created["id"])
        request_status = map_status(str(created.get("status") or "DRAFT"))

        return JSONResponse(
            content={
                "code": 0,
                "requests": {"request_id": request_id, "request_status": request_status},
                "message": "Request created successfully",
            },
            status_code=200,
        )
    except ValueError as e:
        raise ZohoAPIError(code=400, message=str(e), status_code=400)
    except ZohoAPIError:
        raise
    except Exception as e:
        raise ZohoAPIError(code=500, message=str(e), status_code=500)

