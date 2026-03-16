"""
SignFlo FastAPI Application
"""
import os
from pathlib import Path
from contextlib import asynccontextmanager
from typing import AsyncGenerator

# Load .env early so config finds DATABASE_URL/REDIS_URL no matter where uvicorn is run from
try:
    from dotenv import load_dotenv
    _backend = Path(__file__).resolve().parent.parent  # backend/
    load_dotenv(_backend / ".env")
    load_dotenv(_backend.parent / ".env")           # signflow/ or signflow/signflow/
    load_dotenv(_backend.parent.parent / ".env")   # signflow/signflow/ when backend is inside signflow/backend
except ImportError:
    pass

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.db import engine
from app.core.logging import setup_logging, get_logger
from app.core.middleware import RequestIDMiddleware, CORSSecurityMiddleware
from app.shared.exceptions import SignFlowException





settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger = get_logger(__name__)
    logger.info("🚀 Starting SignFlo API...")
    logger.info(f"Environment: {settings.APP_ENV}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    logger.info(f"Email sender (EMAIL_FROM) for signing requests: {settings.EMAIL_FROM}")
    logger.info(
        f"Resend API key (RESEND_API_KEY): {'set (' + str(len(settings.RESEND_API_KEY)) + ' chars)' if settings.RESEND_API_KEY else 'NOT SET (emails will not be sent)'}"
    )

    yield

    logger.info("🛑 Shutting down SignFlo API...")
    if engine is not None:
        await engine.dispose()


# 1️⃣ CREATE APP FIRST
app = FastAPI(
    title=settings.APP_NAME,
    description="SignFlo - Document Signature Management System",
    version="0.1.0",
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# 2️⃣ SETUP LOGGING AFTER APP EXISTS
setup_logging()
logger = get_logger(__name__)

# 3️⃣ MIDDLEWARE (custom RequestID/Security disabled: they caused "Empty reply from server" in Docker)
# app.add_middleware(RequestIDMiddleware)
# app.add_middleware(CORSSecurityMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4️⃣ ROUTERS (AFTER APP)
from app.modules.auth.router import router as auth_router
app.include_router(auth_router)
from app.modules.files.router import router as files_router
app.include_router(files_router)
from app.modules.signatures.router import router as signatures_router
app.include_router(signatures_router)
from app.modules.signing_requests.router import router as signing_requests_router
app.include_router(signing_requests_router)
from app.modules.signing_requests.signing_router import router as signing_router
app.include_router(signing_router)

# 5️⃣ EXCEPTION HANDLERS
@app.exception_handler(SignFlowException)
async def signflow_exception_handler(
    request: Request, exc: SignFlowException
) -> JSONResponse:
    logger.error(f"SignFlo exception: {exc.code} - {exc.message}")

    status_map = {
        "NOT_FOUND": status.HTTP_404_NOT_FOUND,
        "VALIDATION_ERROR": status.HTTP_422_UNPROCESSABLE_ENTITY,
        "CONFLICT": status.HTTP_409_CONFLICT,
        "DATABASE_ERROR": status.HTTP_500_INTERNAL_SERVER_ERROR,
        "UNAUTHORIZED": status.HTTP_401_UNAUTHORIZED,
        "FORBIDDEN": status.HTTP_403_FORBIDDEN,
    }

    return JSONResponse(
        status_code=status_map.get(exc.code, 500),
        content=exc.to_dict(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    logger.error("Unexpected exception", exc_info=True)

    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
                "details": {"error": str(exc)} if settings.DEBUG else {},
            }
        },
    )


# 6️⃣ HEALTH (no Request dependency so response is always sent)
@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "version": "0.1.0",
    }


