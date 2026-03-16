"""
Usage logging middleware: log each API-key request after response.
"""
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.db import AsyncSessionLocal
from app.repositories import log_usage

logger = logging.getLogger(__name__)


class UsageLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        api_key_id = getattr(request.state, "api_key_id", None)
        if not api_key_id:
            return response
        try:
            async with AsyncSessionLocal() as session:
                await log_usage(
                    session,
                    api_key_id=api_key_id,
                    endpoint=request.url.path or "",
                    method=request.method or "",
                    status_code=response.status_code,
                    ip=request.client.host if request.client else None,
                )
                await session.commit()
        except Exception as e:
            logger.warning("Failed to log API usage: %s", e)
        return response
