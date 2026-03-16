"""
SignFlo Public API Wrapper - runs on port 9080, forwards to backend on 8000.
API key auth, rate limiting, usage logging; document/template APIs proxy with service JWT.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
import httpx

from app.config import get_settings
from app.db import init_db
from app.backend_client import get_backend_client
from app.middleware import UsageLoggingMiddleware
from app.routers import documents, keys, signatures

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
app.include_router(documents.router)
app.include_router(keys.router)
app.include_router(signatures.router)


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
