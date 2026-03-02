"""
FastAPI middleware for request tracking and logging.

Uses pure pass-through for the response so the connection is never hung.
Request ID and security headers are added only when the response has started.
"""
import uuid
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.logging import get_logger, set_request_id

logger = get_logger(__name__)


def _get_header(scope: Scope, name: str) -> str | None:
    try:
        for k, v in scope.get("headers", []):
            if k.decode("utf-8", errors="replace").lower() == name.lower():
                return v.decode("utf-8", errors="replace")
    except Exception:
        pass
    return None


class RequestIDMiddleware:
    """ASGI middleware: set request_id in context and add X-Request-ID to response."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return
        request_id = _get_header(scope, "x-request-id") or str(uuid.uuid4())
        try:
            set_request_id(request_id)
        except Exception:
            pass

        async def send_wrapper(message: dict) -> None:
            if message.get("type") == "http.response.start":
                h = list(message.get("headers") or [])
                h.append((b"x-request-id", request_id.encode("utf-8")))
                await send({**message, "headers": h})
            else:
                await send(message)

        await self.app(scope, receive, send_wrapper)


class CORSSecurityMiddleware:
    """ASGI middleware: add security headers to response."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message: dict) -> None:
            if message.get("type") == "http.response.start":
                h = list(message.get("headers") or [])
                h.append((b"x-content-type-options", b"nosniff"))
                h.append((b"x-frame-options", b"DENY"))
                h.append((b"x-xss-protection", b"1; mode=block"))
                await send({**message, "headers": h})
            else:
                await send(message)

        await self.app(scope, receive, send_wrapper)


