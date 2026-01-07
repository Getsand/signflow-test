"""
Structured logging configuration with request_id support
"""
import logging
import sys
from typing import Any, Dict
from contextvars import ContextVar

from app.core.config import get_settings

settings = get_settings()

# Context variable to store request_id across async contexts
request_id_var: ContextVar[str] = ContextVar("request_id", default="")


class StructuredFormatter(logging.Formatter):
    """
    Custom formatter that outputs structured logs with request_id
    """
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record with structured information"""
        # Get request_id from context
        request_id = request_id_var.get("")
        
        # Build structured log entry
        log_data: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        
        # Add request_id if available
        if request_id:
            log_data["request_id"] = request_id
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields from record
        if hasattr(record, "extra"):
            log_data.update(record.extra)
        
        # Format as key=value pairs for easy parsing
        formatted_parts = []
        for key, value in log_data.items():
            if isinstance(value, str) and " " in value:
                formatted_parts.append(f'{key}="{value}"')
            else:
                formatted_parts.append(f"{key}={value}")
        
        return " ".join(formatted_parts)


def setup_logging() -> None:
    """
    Configure application logging with structured output
    """
    # Determine log level based on environment
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO

    
    # Create handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)
    
    # Set structured formatter
    formatter = StructuredFormatter(
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    handler.setFormatter(formatter)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.addHandler(handler)
    
    # Reduce noise from third-party libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.DEBUG else logging.WARNING
    )


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with the given name
    
    Args:
        name: Logger name (typically __name__)
    
    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)


def set_request_id(request_id: str) -> None:
    """
    Set the request_id for the current context
    
    Args:
        request_id: Unique request identifier
    """
    request_id_var.set(request_id)


def get_request_id() -> str:
    """
    Get the request_id for the current context
    
    Returns:
        Current request_id or empty string
    """
    return request_id_var.get("")

