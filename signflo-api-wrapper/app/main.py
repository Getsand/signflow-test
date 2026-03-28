"""
SignFlo Public API Wrapper - runs on port 9080, forwards to backend on 8000.
API key auth, rate limiting, usage logging; document/template APIs proxy with service JWT.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
import httpx

from app.config import get_settings
from app.db import init_db
from app.backend_client import get_backend_client
from app.middleware import UsageLoggingMiddleware
from app.routers import documents, keys, signatures
from api.signflo.actions import router as signflo_actions_router
from api.signflo.auth import ZohoAPIError, zoho_api_error_handler, router as signflo_auth_router
from api.signflo.requests import router as signflo_requests_router
from api.signflo.templates import router as signflo_templates_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    base = (settings.backend_base_url or "http://127.0.0.1:8000").strip().rstrip("/")
    app.state.http_client = httpx.AsyncClient(
        base_url=base,
        timeout=settings.request_timeout_seconds,
    )
    app.state.backend_client = get_backend_client()
    await init_db()
    try:
        yield
    finally:
        await app.state.http_client.aclose()
        await app.state.backend_client.aclose()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)
app.add_middleware(UsageLoggingMiddleware)
app.add_exception_handler(ZohoAPIError, zoho_api_error_handler)


def _is_signflo_zoho_compatible_path(path: str) -> bool:
    return (
        path.startswith("/oauth/v2/token")
        or path.startswith("/api/v1/requests")
        or path.startswith("/api/v1/templates")
    )


@app.exception_handler(RequestValidationError)
async def signflo_validation_exception_handler(request: Request, exc: RequestValidationError):
    if not _is_signflo_zoho_compatible_path(request.url.path):
        # Fall back to FastAPI's default behavior.
        return JSONResponse(status_code=422, content={"detail": exc.errors()})

    # Keep Zoho-compatible error shape.
    msg = exc.errors()[0].get("msg") if exc.errors() else "Validation error"
    return JSONResponse(status_code=422, content={"code": 422, "message": str(msg)})


@app.exception_handler(HTTPException)
async def signflo_http_exception_handler(request: Request, exc: HTTPException):
    if not _is_signflo_zoho_compatible_path(request.url.path):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    return JSONResponse(status_code=exc.status_code, content={"code": exc.status_code, "message": str(exc.detail)})
app.include_router(documents.router)
app.include_router(keys.router)
app.include_router(signatures.router)
app.include_router(signflo_auth_router)
app.include_router(signflo_requests_router)
app.include_router(signflo_templates_router)
app.include_router(signflo_actions_router)


@app.get("/", tags=["System"], response_class=JSONResponse)
async def root():
    """Root - confirms this is the API wrapper (port 9080)."""
    return JSONResponse(
        content={"service": "signflo-api-wrapper", "health": "http://127.0.0.1:9080/health", "docs": "http://127.0.0.1:9080/docs"},
        headers={"Content-Type": "application/json; charset=utf-8"},
    )


@app.get("/health", tags=["System"], response_class=JSONResponse)
async def health():
    """Health check - no auth."""
    return JSONResponse(
        content={"status": "healthy", "service": "signflo-api-wrapper"},
        headers={"Content-Type": "application/json; charset=utf-8"},
    )


@app.get("/ping", tags=["System"])
async def ping():
    """Minimal raw response - use to verify server sends valid HTTP."""
    return Response(content=b"pong", media_type="text/plain")


@app.get("/api/v1", tags=["Public API"])
async def api_info():
    """Public API info - use Authorization: Bearer YOUR_API_KEY for protected routes."""
    return {
        "name": "SignFlo Public API",
        "version": "v1",
        "docs": "/docs",
        "backend": settings.backend_base_url,
    }


@app.get("/api/v1/backend/health", tags=["Public API"])
async def backend_health(request: Request):
    """Proxy to SignFlo backend /health - verifies backend is reachable."""
    client: httpx.AsyncClient = request.app.state.http_client
    try:
        r = await client.get("/health")
        return {"backend_status": r.status_code, "backend_response": r.json()}
    except Exception as e:
        return {"backend_status": "error", "detail": str(e)}
