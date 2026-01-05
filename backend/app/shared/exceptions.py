"""
Custom exception hierarchy for the application
"""
from typing import Any, Dict, Optional


class SignFlowException(Exception):
    """
    Base exception for all SignFlow application errors
    
    Attributes:
        message: Human-readable error message
        code: Application-specific error code
        details: Additional error context
    """
    
    def __init__(
        self,
        message: str,
        code: str = "SIGNFLOW_ERROR",
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.code = code
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for API responses"""
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details
            }
        }


class NotFoundError(SignFlowException):
    """Raised when a requested resource is not found"""
    
    def __init__(
        self,
        message: str = "Resource not found",
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, code="NOT_FOUND", details=details)


class ValidationError(SignFlowException):
    """Raised when input validation fails"""
    
    def __init__(
        self,
        message: str = "Validation failed",
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, code="VALIDATION_ERROR", details=details)


class ConflictError(SignFlowException):
    """Raised when an operation conflicts with current state"""
    
    def __init__(
        self,
        message: str = "Resource conflict",
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, code="CONFLICT", details=details)


class DatabaseError(SignFlowException):
    """Raised when a database operation fails"""
    
    def __init__(
        self,
        message: str = "Database operation failed",
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, code="DATABASE_ERROR", details=details)


class UnauthorizedError(SignFlowException):
    """Raised when authentication is required but not provided"""
    
    def __init__(
        self,
        message: str = "Authentication required",
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, code="UNAUTHORIZED", details=details)


class ForbiddenError(SignFlowException):
    """Raised when user lacks permission for an action"""
    
    def __init__(
        self,
        message: str = "Permission denied",
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message, code="FORBIDDEN", details=details)

