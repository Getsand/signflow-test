"""
SignFlow FastAPI Application - Phase A1
"""
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.db import engine
from app.core.logging import setup_logging, get_logger
from app.core.middleware import RequestIDMiddleware, CORSSecurityMiddleware
from app.shared.exceptions import SignFlowException

# Initialize settings and logging
settings = get_settings()
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager"""
    # Startup
    logger.info("🚀 Starting SignFlow API...")
    logger.info(f"Environment: {settings.app_env}")
    logger.info(f"Debug mode: {settings.debug}")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down SignFlow API...")
    await engine.dispose()


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="SignFlow - Document Signature Management System",
    version="0.1.0",
    debug=settings.debug,
    lifespan=lifespan,
)

# Add middleware (order matters - first added is outermost)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(CORSSecurityMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.debug else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(SignFlowException)
async def signflow_exception_handler(
    request: Request, exc: SignFlowException
) -> JSONResponse:
    """Handle custom SignFlow exceptions"""
    logger.error(f"SignFlow exception: {exc.code} - {exc.message}")
    
    status_map = {
        "NOT_FOUND": status.HTTP_404_NOT_FOUND,
        "VALIDATION_ERROR": status.HTTP_422_UNPROCESSABLE_ENTITY,
        "CONFLICT": status.HTTP_409_CONFLICT,
        "DATABASE_ERROR": status.HTTP_500_INTERNAL_SERVER_ERROR,
        "UNAUTHORIZED": status.HTTP_401_UNAUTHORIZED,
        "FORBIDDEN": status.HTTP_403_FORBIDDEN,
    }
    
    status_code = status_map.get(exc.code, status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    return JSONResponse(
        status_code=status_code,
        content=exc.to_dict()
    )


@app.exception_handler(Exception)
async def general_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Handle unexpected exceptions"""
    logger.error(f"Unexpected exception: {str(exc)}", exc_info=True)
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
                "details": {} if not settings.debug else {"error": str(exc)}
            }
        }
    )


# Health check endpoint
@app.get("/health", tags=["System"])
async def health_check(request: Request):
    """
    Health check endpoint
    
    Returns the application status and basic info
    """
    logger.debug("Health check requested")
    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "environment": settings.app_env,
        "version": "0.1.0",
        "request_id": getattr(request.state, "request_id", None)
    }


# Root endpoint
@app.get("/", tags=["System"])
async def root():
    """Root endpoint"""
    logger.debug("Root endpoint accessed")
    return {
        "message": "Welcome to SignFlow API",
        "docs": "/docs",
        "health": "/health"
    }

