from __future__ import annotations

import json
import secrets
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse


class ZohoAPIError(Exception):
    def __init__(self, *, code: int, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


async def zoho_api_error_handler(_: Request, exc: ZohoAPIError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.code, "message": exc.message},
    )


router = APIRouter(tags=["Zoho Sign Compatible – Auth"])


@dataclass
class _TokenRecord:
    token: str
    expires_at: float
    issued_at: float


# In-memory token store.
# This keeps the wrapper isolated from backend DB changes, but tokens will be lost on restart.
_ACCESS_TOKENS: Dict[str, _TokenRecord] = {}
_REFRESH_TOKENS: Dict[str, _TokenRecord] = {}


def _now() -> float:
    return time.time()


def _build_api_domain(request: Request) -> str:
    # Best-effort domain reconstruction for Zoho OAuth response.
    host = request.headers.get("host", "")
    scheme = request.url.scheme or "https"
    if not host:
        return f"{scheme}://localhost"
    return f"{scheme}://{host}"


def _create_tokens(*, ttl_seconds: int) -> tuple[str, str, int]:
    access = secrets.token_urlsafe(48)
    refresh = secrets.token_urlsafe(48)
    expires_in = ttl_seconds
    now = _now()

    _ACCESS_TOKENS[access] = _TokenRecord(token=access, expires_at=now + ttl_seconds, issued_at=now)
    _REFRESH_TOKENS[refresh] = _TokenRecord(token=refresh, expires_at=now + ttl_seconds * 24, issued_at=now)
    return access, refresh, expires_in


def _validate_access_token(token: str) -> bool:
    rec = _ACCESS_TOKENS.get(token)
    if not rec:
        return False
    return rec.expires_at > _now()


def _validate_refresh_token(token: str) -> bool:
    rec = _REFRESH_TOKENS.get(token)
    if not rec:
        return False
    return rec.expires_at > _now()


def _parse_token_endpoint_payload(request: Request) -> Dict[str, Any]:
    # Zoho typically sends x-www-form-urlencoded, but we accept JSON too.
    content_type = (request.headers.get("content-type") or "").lower()

    if "application/json" in content_type:
        # request.json() is async; callers should have awaited. Here we only parse from body string.
        raise RuntimeError("JSON parsing should happen in the async endpoint")

    return {}


def _extract_zoho_oauthtoken_header(request: Request) -> Optional[str]:
    # Wrapper supports both:
    #   Authorization: Zoho-oauthtoken {token}  (backward compatible)
    #   Authorization: SignFlo-oauthtoken {token} (preferred for SignFlo branding)
    raw = request.headers.get("Authorization") or request.headers.get("authorization")
    if not raw:
        return None

    prefixes = ("zoho-oauthtoken ", "signflo-oauthtoken ")
    if isinstance(raw, str):
        lower = raw.lower()
        for prefix in prefixes:
            if lower.startswith(prefix):
                return raw[len(prefix) :].strip()
    return None


async def require_zoho_oauthtoken(request: Request) -> str:
    token = _extract_zoho_oauthtoken_header(request)
    if not token:
        raise ZohoAPIError(code=1, message="Missing or invalid SignFlo-oauthtoken", status_code=401)
    if not _validate_access_token(token):
        raise ZohoAPIError(code=2, message="Invalid or expired access token", status_code=401)
    return token


@router.post("/oauth/v2/token", response_class=JSONResponse)
async def oauth_token(request: Request):
    """
    Zoho Sign compatible OAuth token endpoint.

    Supports:
      - grant_type=authorization_code
      - grant_type=refresh_token
    """
    # Parse form-encoded OR JSON body.
    content_type = (request.headers.get("content-type") or "").lower()
    payload: Dict[str, Any] = {}

    if "application/json" in content_type:
        payload = await request.json()
        if not isinstance(payload, dict):
            raise ZohoAPIError(code=400, message="Invalid JSON payload", status_code=400)
    else:
        form = await request.form()
        payload = dict(form)

    grant_type = str(payload.get("grant_type") or payload.get("grantType") or "").strip()
    if not grant_type:
        raise ZohoAPIError(code=400, message="grant_type is required", status_code=400)

    ttl_seconds = 3600

    if grant_type == "authorization_code":
        code = payload.get("code") or payload.get("authorization_code") or ""
        if not code:
            raise ZohoAPIError(code=400, message="authorization_code grant requires 'code'", status_code=400)

        access, refresh, expires_in = _create_tokens(ttl_seconds=ttl_seconds)
        return JSONResponse(
            content={
                "access_token": access,
                "refresh_token": refresh,
                "api_domain": _build_api_domain(request),
                "token_type": "Bearer",
                "expires_in": expires_in,
            }
        )

    if grant_type == "refresh_token":
        refresh_token = payload.get("refresh_token") or ""
        if not refresh_token:
            raise ZohoAPIError(code=400, message="refresh_token grant requires 'refresh_token'", status_code=400)
        if not _validate_refresh_token(refresh_token):
            raise ZohoAPIError(code=401, message="Invalid or expired refresh_token", status_code=401)

        # Issue a new access token; keep refresh token stable (Zoho-compatible enough).
        new_access = secrets.token_urlsafe(48)
        now = _now()
        _ACCESS_TOKENS[new_access] = _TokenRecord(
            token=new_access,
            expires_at=now + ttl_seconds,
            issued_at=now,
        )
        return JSONResponse(
            content={
                "access_token": new_access,
                "refresh_token": str(refresh_token),
                "api_domain": _build_api_domain(request),
                "token_type": "Bearer",
                "expires_in": ttl_seconds,
            }
        )

    raise ZohoAPIError(code=400, message=f"Unsupported grant_type: {grant_type}", status_code=400)

