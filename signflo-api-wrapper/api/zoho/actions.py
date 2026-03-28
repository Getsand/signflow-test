from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend_client import BackendClient
from app.db import get_db

from adapters.zoho_adapter import map_actions

from api.zoho.auth import ZohoAPIError, require_zoho_oauthtoken
from api.zoho.id_resolve import resolve_backend_signing_request_id


router = APIRouter(tags=["Zoho Sign Compatible – Actions"])


def _get_backend(request: Request) -> BackendClient:
    return request.app.state.backend_client


def _zoho_frontend_base_url() -> str:
    return os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")


async def _fetch_recipient_sign_tokens(
    *,
    backend: BackendClient,
    request_id: str,
) -> Dict[str, str]:
    """
    Calls a helper endpoint on the backend that returns signing tokens per recipient.
    """
    r = await backend.get(f"/api/v1/signing-requests/{request_id}/recipient-sign-tokens")
    if r.status_code != 200:
        raise ZohoAPIError(code=r.status_code, message=r.text or "Failed to fetch recipient sign tokens", status_code=r.status_code)

    rows = r.json() or []
    out: Dict[str, str] = {}
    for row in rows:
        rid = str(row.get("recipient_id") or row.get("id") or "")
        token = row.get("signing_token") or row.get("token")
        if rid and token:
            out[rid] = str(token)
    return out


@router.get("/api/v1/requests/{request_id}/actions", response_class=JSONResponse)
async def list_actions(
    request: Request,
    request_id: str,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(require_zoho_oauthtoken),
):
    backend = _get_backend(request)
    try:
        backend_id, _ = await resolve_backend_signing_request_id(session, request_id, allow_draft=False)

        detail_r = await backend.get(f"/api/v1/signing-requests/{backend_id}")
        if detail_r.status_code != 200:
            raise ZohoAPIError(code=detail_r.status_code, message=detail_r.text or "Failed to fetch request details", status_code=detail_r.status_code)

        detail = detail_r.json()
        recipients = detail.get("recipients", [])

        signing_tokens = await _fetch_recipient_sign_tokens(backend=backend, request_id=backend_id)

        actions = map_actions(
            recipients,
            signing_tokens=signing_tokens,
            frontend_base_url=_zoho_frontend_base_url(),
        )
        return JSONResponse(content={"code": 0, "actions": actions}, status_code=200)
    except ZohoAPIError:
        raise
    except Exception as e:
        raise ZohoAPIError(code=500, message=str(e), status_code=500)


@router.get("/api/v1/requests/{request_id}/actions/{action_id}/sign", response_class=JSONResponse)
async def action_sign(
    request: Request,
    request_id: str,
    action_id: str,
    session: AsyncSession = Depends(get_db),
    _: str = Depends(require_zoho_oauthtoken),
):
    backend = _get_backend(request)
    try:
        backend_id, _ = await resolve_backend_signing_request_id(session, request_id, allow_draft=False)
        tokens = await _fetch_recipient_sign_tokens(backend=backend, request_id=backend_id)
        token = tokens.get(str(action_id))
        if not token:
            raise ZohoAPIError(code=404, message="signing token not found for action", status_code=404)

        sign_url = f"{_zoho_frontend_base_url().rstrip('/')}/sign/{token}"
        return JSONResponse(content={"code": 0, "sign_url": sign_url}, status_code=200)
    except ZohoAPIError:
        raise
    except Exception as e:
        raise ZohoAPIError(code=500, message=str(e), status_code=500)

