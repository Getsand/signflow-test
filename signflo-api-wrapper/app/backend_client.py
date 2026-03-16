"""
SignFlo backend HTTP client: login once, cache JWT, use for all proxy requests.
No changes to backend code; wrapper uses a dedicated service user.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


class BackendClient:
    def __init__(self, base_url: str, email: str, password: str, timeout: float = 10.0):
        self.base_url = base_url.rstrip("/")
        self.email = email
        self.password = password
        self.timeout = timeout
        self._token: Optional[str] = None
        self._client: Optional[httpx.AsyncClient] = None

    async def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout,
            )
        return self._client

    async def _login(self) -> str:
        client = await self._ensure_client()
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": self.email, "password": self.password},
        )
        r.raise_for_status()
        data = r.json()
        token = data.get("access_token")
        if not token:
            raise ValueError("Backend login did not return access_token")
        self._token = token
        logger.info("Backend JWT refreshed for service user %s", self.email)
        return token

    async def get_auth_headers(self) -> dict[str, str]:
        if not self._token:
            await self._login()
        return {"Authorization": f"Bearer {self._token}"}

    async def request(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        content: Optional[bytes] = None,
        params: Optional[dict] = None,
        headers: Optional[dict] = None,
    ) -> httpx.Response:
        client = await self._ensure_client()
        auth_headers = await self.get_auth_headers()
        merged = {**auth_headers, **(headers or {})}
        r = await client.request(
            method,
            path,
            json=json,
            content=content,
            params=params,
            headers=merged,
        )
        if r.status_code == 401:
            self._token = None
            await self._login()
            merged = await self.get_auth_headers()
            r = await client.request(
                method,
                path,
                json=json,
                content=content,
                params=params,
                headers={**merged, **(headers or {})},
            )
        return r

    async def get(self, path: str, **kwargs) -> httpx.Response:
        return await self.request("GET", path, **kwargs)

    async def post(self, path: str, **kwargs) -> httpx.Response:
        return await self.request("POST", path, **kwargs)

    async def delete(self, path: str, **kwargs) -> httpx.Response:
        return await self.request("DELETE", path, **kwargs)

    async def aclose(self):
        if self._client:
            await self._client.aclose()
            self._client = None
        self._token = None


def get_backend_client() -> BackendClient:
    s = get_settings()
    return BackendClient(
        base_url=s.backend_base_url,
        email=s.backend_email,
        password=s.backend_password,
        timeout=s.request_timeout_seconds,
    )
