"""
FastAPI middleware for request tracking and logging
"""
import time
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import get_logger, set_request_id

logger = get_logger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add request_id to all requests and responses.
    Sets the request_id in context for structured logging.
    """
    
    async def dispatch(
        self, request: Request, call_next: Callable
    ) -> Response:
        """
        Process request and add request_id tracking
        
        Args:
            request: Incoming HTTP request
            call_next: Next middleware/route handler
        
        Returns:
            HTTP response with request_id header
        """
        # Generate or extract request_id
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        
        # Set request_id in context for logging
        set_request_id(request_id)
        
        # Add request_id to request state for access in routes
        request.state.request_id = request_id
        
        # Log incoming request
        start_time = time.time()
        logger.info(
            f"Request started method={request.method} path={request.url.path}"
        )
        
        # Process request
        try:
            response = await call_next(request)
            
            # Calculate request duration
            duration = time.time() - start_time
            
            # Log completed request
            logger.info(
                f"Request completed status={response.status_code} "
                f"duration={duration:.3f}s"
            )
            
            # Add request_id to response headers
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as exc:
            # Log failed request
            duration = time.time() - start_time
            logger.error(
                f"Request failed error={str(exc)} duration={duration:.3f}s",
                exc_info=True
            )
            raise


class CORSSecurityMiddleware(BaseHTTPMiddleware):
    """
    Additional security headers middleware
    """
    
    async def dispatch(
        self, request: Request, call_next: Callable
    ) -> Response:
        """
        Add security headers to responses
        
        Args:
            request: Incoming HTTP request
            call_next: Next middleware/route handler
        
        Returns:
            HTTP response with security headers
        """
        response = await call_next(request)
        
        # Add security headers (basic set)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        return response


