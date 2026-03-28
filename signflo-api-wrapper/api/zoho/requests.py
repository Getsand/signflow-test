from __future__ import annotations

import io
import json
import os
from typing import Any, Dict, List, Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app import wrapper_zoho_store
from app.backend_client import BackendClient
from app.db import get_db

from adapters.zoho_adapter import (
    convert_actions_to_signature_fields,
    convert_create_request_payload,
    map_actions,
    map_status,
)

from api.zoho.auth import ZohoAPIError, require_zoho_oauthtoken
from api.zoho.id_resolve import resolve_backend_signing_request_id


router = APIRouter(tags=["Zoho Sign Compatible – Requests"])


def _get_backend(request: Request) -> BackendClient:
    return request.app.state.backend_client


def _zoho_frontend_base_url() -> str:
    return os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")


async def _get_backend_owner_id(backend: BackendClient) -> str:
    me_resp = await backend.get("/api/v1/auth/me")
    if me_resp.status_code != 200:
        raise ZohoAPIError(code=500, message=me_resp.text or "Failed to resolve backend /auth/me", status_code=500)
    me = me_resp.json() or {}
    owner_id = me.get("id")
    if not owner_id:
        raise ZohoAPIError(code=500, message="Backend /auth/me did not return user id", status_code=500)
    return str(owner_id)


async def _backend_template_field_count(backend: BackendClient, file_id: str) -> int:
    r = await backend.get("/api/v1/signatures/fields", params={"file_id": file_id})
    if r.status_code != 200:
        return 0
    data = r.json()
    return len(data) if isinstance(data, list) else 0


async def _create_template_signature_fields(
    *,
    backend: BackendClient,
    template_id: str,
    requests_payload: Dict[str, Any],
    recipients: List[Dict[str, Any]],
) -> None:
    fields = convert_actions_to_signature_fields(
        requests_payload=requests_payload,
        recipients=recipients,
    )
    if not fields:
        raise ZohoAPIError(
            code=400,
            message=(
                "No signature field coordinates found under actions. "
                "Use either (1) flat action fields: pageNumber, left, top, width, height, signerEmail; "
                "or (2) official Zoho shape: each action includes fields[] with x_value, y_value, width, height, page_no (0-based), "
                "and recipient_email on the action. Ensure recipient emails match your recipients list."
            ),
            status_code=400,
        )

    owner_id = await _get_backend_owner_id(backend)

    for f in fields:
        role = f.get("role")
        field_payload = {
            "file_id": template_id,
            "page": f["page"],
            "x": f["x"],
            "y": f["y"],
            "width": f["width"],
            "height": f["height"],
            "assigned_to": owner_id,
            "field_type": f.get("field_type") or "SIGNATURE",
            "role": role,
        }
        r = await backend.post("/api/v1/signatures/fields", json=field_payload)
        if r.status_code not in (200, 201):
            raise ZohoAPIError(code=r.status_code, message=r.text or "Failed to create signature field", status_code=r.status_code)


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
                "Uploaded PDF is empty (0 bytes). Postman often drops the file path after import: "
                "open Body → form-data → file row → Select File and choose a real PDF again. "
                "Do not set a manual Content-Type header on this request."
            ),
            status_code=400,
        )
    if len(content) > 10 * 1024 * 1024:
        raise ZohoAPIError(code=413, message="File too large (max 10MB)", status_code=413)

    mime_type = file.content_type or "application/pdf"
    out_filename = filename or file.filename or "document.pdf"
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


@router.post("/api/v1/requests", response_class=JSONResponse)
async def create_request(
    request: Request,
    requests: str = Form(..., description="Zoho requests JSON field (as string)"),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
    _: str = Depends(require_zoho_oauthtoken),
):
    """
    CREATE REQUEST — uploads the PDF and stores signers + field definitions in the wrapper only.
    Does not create a SignFlo signing request yet (so nothing is emailed). Use POST .../send next.
    """
    backend = _get_backend(request)

    try:
        try:
            requests_payload = json.loads(requests)
        except Exception:
            raise ZohoAPIError(code=400, message="Invalid 'requests' JSON field", status_code=400)

        if not isinstance(requests_payload, dict):
            raise ZohoAPIError(code=400, message="'requests' must be a JSON object", status_code=400)

        internal = convert_create_request_payload(requests_payload)

        template_id = await _upload_file_and_create_template(
            backend=backend,
            file=file,
            filename=internal.get("filename") if isinstance(internal, dict) else None,
        )

        wrapper_id = await wrapper_zoho_store.create_draft(
            session,
            file_id=template_id,
            requests_json=json.dumps(requests_payload),
        )

        return JSONResponse(
            content={
                "code": 0,
                "requests": {"request_id": wrapper_id, "request_status": map_status("DRAFT")},
                "message": "Request created (draft). Call POST /api/v1/requests/{request_id}/send to notify signers.",
            },
            status_code=200,
        )
    except ValueError as e:
        raise ZohoAPIError(code=400, message=str(e), status_code=400)
    except ZohoAPIError:
        raise
    except Exception as e:
        raise ZohoAPIError(code=500, message=str(e), status_code=500)


@router.post("/api/v1/requests/{request_id}/send", response_class=JSONResponse)
async def send_request(
    request: Request,
    request_id: str,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(require_zoho_oauthtoken),
):
    backend = _get_backend(request)
    try:
        _ = UUID(request_id)

        row = await wrapper_zoho_store.get_by_wrapper_id(session, request_id)

        if row is not None:
            if row.backend_signing_request_id:
                bid = row.backend_signing_request_id
                send_r = await backend.post(f"/api/v1/signing-requests/{bid}/send")
                if send_r.status_code != 200:
                    raw = send_r.text or ""
                    if "Cannot send from SENT status" in raw:
                        return JSONResponse(
                            content={
                                "code": 0,
                                "requests": {"request_id": str(request_id), "request_status": "sent"},
                                "message": "Request was already SENT.",
                            },
                            status_code=200,
                        )
                    raise ZohoAPIError(
                        code=send_r.status_code,
                        message=raw or "Failed to send request",
                        status_code=send_r.status_code,
                    )
                data = send_r.json()
                signing_request = data.get("signing_request") or {}
                internal_status = str(signing_request.get("status") or "SENT")
                mapped_status = map_status(internal_status)
                return JSONResponse(
                    content={
                        "code": 0,
                        "requests": {"request_id": str(request_id), "request_status": mapped_status},
                        "message": "Request sent successfully",
                    },
                    status_code=200,
                )

            try:
                requests_payload = json.loads(row.requests_json)
            except Exception:
                raise ZohoAPIError(code=400, message="Stored requests payload is invalid JSON", status_code=400)
            internal = convert_create_request_payload(requests_payload)

            n_fields = await _backend_template_field_count(backend, row.file_id)
            if n_fields == 0:
                await _create_template_signature_fields(
                    backend=backend,
                    template_id=row.file_id,
                    requests_payload=requests_payload,
                    recipients=internal.get("recipients", []),
                )

            create_r = await backend.post(
                "/api/v1/signing-requests",
                json={
                    "file_id": row.file_id,
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
            row.backend_signing_request_id = str(created["id"])
            await session.flush()

            internal_status = str(created.get("status") or "DRAFT")
            mapped_status = map_status(internal_status)

            return JSONResponse(
                content={
                    "code": 0,
                    "requests": {"request_id": str(request_id), "request_status": mapped_status},
                    "message": "Request sent successfully",
                },
                status_code=200,
            )

        send_r = await backend.post(f"/api/v1/signing-requests/{request_id}/send")
        if send_r.status_code != 200:
            raw = send_r.text or ""
            if "Cannot send from SENT status" in raw:
                return JSONResponse(
                    content={
                        "code": 0,
                        "requests": {"request_id": str(request_id), "request_status": "sent"},
                        "message": "Request was already SENT.",
                    },
                    status_code=200,
                )
            raise ZohoAPIError(
                code=send_r.status_code,
                message=raw or "Failed to send request",
                status_code=send_r.status_code,
            )

        data = send_r.json()
        signing_request = data.get("signing_request") or {}
        internal_status = str(signing_request.get("status") or "SENT")
        mapped_status = map_status(internal_status)

        return JSONResponse(
            content={
                "code": 0,
                "requests": {"request_id": str(request_id), "request_status": mapped_status},
                "message": "Request sent successfully",
            },
            status_code=200,
        )
    except ZohoAPIError:
        raise
    except Exception as e:
        raise ZohoAPIError(code=500, message=str(e), status_code=500)


@router.get("/api/v1/requests/{request_id}", response_class=JSONResponse)
async def get_request_details(
    request: Request,
    request_id: str,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(require_zoho_oauthtoken),
):
    backend = _get_backend(request)
    try:
        _ = UUID(request_id)

        backend_id, row = await resolve_backend_signing_request_id(session, request_id, allow_draft=True)

        if backend_id is None and row is not None:
            try:
                requests_payload = json.loads(row.requests_json)
            except Exception:
                raise ZohoAPIError(code=400, message="Stored requests payload is invalid JSON", status_code=400)
            internal = convert_create_request_payload(requests_payload)
            recipients_for_map: List[Dict[str, Any]] = []
            recipients_public: List[Dict[str, Any]] = []
            for idx, pr in enumerate(internal.get("recipients", [])):
                rid = f"draft-{idx}"
                recipients_for_map.append(
                    {
                        "id": rid,
                        "role": pr.get("role"),
                        "email": pr.get("email"),
                        "order_index": pr.get("order_index", idx),
                        "status": "PENDING",
                    }
                )
                recipients_public.append(
                    {
                        "recipient_id": rid,
                        "recipient_name": pr.get("role"),
                        "recipient_email": pr.get("email"),
                        "order_index": pr.get("order_index", idx),
                        "recipient_status": "PENDING",
                    }
                )
            actions = map_actions(recipients_for_map, frontend_base_url=_zoho_frontend_base_url())
            return JSONResponse(
                content={
                    "code": 0,
                    "requests": {
                        "request_id": str(request_id),
                        "request_status": map_status("DRAFT"),
                        "actions": actions,
                        "recipients": recipients_public,
                    },
                },
                status_code=200,
            )

        assert backend_id is not None
        r = await backend.get(f"/api/v1/signing-requests/{backend_id}")
        if r.status_code != 200:
            raise ZohoAPIError(code=r.status_code, message=r.text or "Failed to fetch request", status_code=r.status_code)

        detail = r.json()
        internal_status = detail.get("status")

        total_fields = detail.get("total_signature_fields")
        signed_fields_count = detail.get("signed_fields_count")

        actions = map_actions(
            detail.get("recipients", []),
            frontend_base_url=_zoho_frontend_base_url(),
        )

        recipients_public = []
        for rec in detail.get("recipients", []):
            recipients_public.append(
                {
                    "recipient_id": str(rec.get("id")),
                    "recipient_name": rec.get("role"),
                    "recipient_email": rec.get("email"),
                    "order_index": rec.get("order_index", 0),
                    "recipient_status": str(rec.get("status") or ""),
                }
            )

        out_request_id = str(request_id)
        return JSONResponse(
            content={
                "code": 0,
                "requests": {
                    "request_id": out_request_id,
                    "request_status": map_status(
                        internal_status,
                        total_signature_fields=total_fields,
                        signed_fields_count=signed_fields_count,
                    ),
                    "actions": actions,
                    "recipients": recipients_public,
                },
            },
            status_code=200,
        )
    except ZohoAPIError:
        raise
    except Exception as e:
        raise ZohoAPIError(code=500, message=str(e), status_code=500)


@router.get("/api/v1/requests", response_class=JSONResponse)
async def list_requests(
    request: Request,
    page: int = 1,
    per_page: int = 10,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(require_zoho_oauthtoken),
):
    backend = _get_backend(request)
    try:
        page = max(1, int(page))
        per_page = max(1, min(100, int(per_page)))

        r = await backend.get("/api/v1/signing-requests")
        if r.status_code != 200:
            raise ZohoAPIError(code=r.status_code, message=r.text or "Failed to list requests", status_code=r.status_code)

        items = r.json() or []
        mapped_backend = []
        for it in items:
            mapped_backend.append(
                {
                    "request_id": str(it.get("id")),
                    "request_status": map_status(str(it.get("status") or "")),
                    "title": it.get("title"),
                    "created_at": it.get("created_at"),
                    "template_id": str(it.get("file_id")) if it.get("file_id") else None,
                }
            )

        drafts = await wrapper_zoho_store.list_unsent_drafts(session)
        draft_items: List[Dict[str, Any]] = []
        for dr in drafts:
            title: Optional[str] = None
            try:
                payload = json.loads(dr.requests_json)
                internal = convert_create_request_payload(payload)
                title = internal.get("title")
            except Exception:
                pass
            draft_items.append(
                {
                    "request_id": dr.wrapper_id,
                    "request_status": map_status("DRAFT"),
                    "title": title,
                    "created_at": dr.created_at.isoformat() if dr.created_at else None,
                    "template_id": dr.file_id,
                }
            )

        combined = draft_items + mapped_backend
        combined.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)

        start = (page - 1) * per_page
        sliced = combined[start : start + per_page]

        return JSONResponse(
            content={"code": 0, "requests": sliced, "page": page, "per_page": per_page},
            status_code=200,
        )
    except ZohoAPIError:
        raise
    except Exception as e:
        raise ZohoAPIError(code=500, message=str(e), status_code=500)


@router.delete("/api/v1/requests/{request_id}", response_class=JSONResponse)
async def delete_request(
    request: Request,
    request_id: str,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(require_zoho_oauthtoken),
):
    backend = _get_backend(request)
    try:
        _ = UUID(request_id)

        backend_id, row = await resolve_backend_signing_request_id(session, request_id, allow_draft=True)

        if row is not None:
            if backend_id:
                dr = await backend.delete(f"/api/v1/signing-requests/{backend_id}")
                if dr.status_code not in (204, 200):
                    raise ZohoAPIError(code=dr.status_code, message=dr.text or "Failed to delete request", status_code=dr.status_code)
            else:
                dr = await backend.delete(f"/api/v1/files/{row.file_id}")
                if dr.status_code not in (204, 200):
                    raise ZohoAPIError(code=dr.status_code, message=dr.text or "Failed to delete template file", status_code=dr.status_code)
            await wrapper_zoho_store.delete_row(session, row)
            return JSONResponse(content={"code": 0, "message": "Request deleted successfully"}, status_code=200)

        assert backend_id == request_id
        r = await backend.delete(f"/api/v1/signing-requests/{request_id}")
        if r.status_code not in (204, 200):
            raise ZohoAPIError(code=r.status_code, message=r.text or "Failed to delete request", status_code=r.status_code)

        return JSONResponse(content={"code": 0, "message": "Request deleted successfully"}, status_code=200)
    except ZohoAPIError:
        raise
    except Exception as e:
        raise ZohoAPIError(code=500, message=str(e), status_code=500)


@router.get("/api/v1/requests/{request_id}/pdf")
async def download_pdf(
    request: Request,
    request_id: str,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(require_zoho_oauthtoken),
):
    backend = _get_backend(request)
    try:
        _ = UUID(request_id)

        backend_id, _row = await resolve_backend_signing_request_id(session, request_id, allow_draft=True)
        if backend_id is None:
            raise ZohoAPIError(
                code=400,
                message="PDF download is available after the request is sent (SignFlo signing request must exist).",
                status_code=400,
            )

        r = await backend.get(f"/api/v1/signing-requests/{backend_id}/download")
        if r.status_code != 200:
            raise ZohoAPIError(code=r.status_code, message=r.text or "Failed to download PDF", status_code=r.status_code)

        return StreamingResponse(
            io.BytesIO(r.content),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{request_id}.pdf"'},
        )
    except ZohoAPIError:
        raise
    except Exception as e:
        raise ZohoAPIError(code=500, message=str(e), status_code=500)
