"""
Wrapper DB models: API keys and usage logs.
"""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import String, Integer, DateTime, ForeignKey, Column, Text
from sqlalchemy.dialects.sqlite import CHAR
from sqlalchemy.orm import relationship

from app.db import Base


def gen_uuid():
    return str(uuid4())


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(CHAR(36), primary_key=True, default=gen_uuid)
    key_hash = Column(String(64), unique=True, nullable=False, index=True)
    key_prefix = Column(String(20), nullable=False)
    company_name = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default="active")
    rate_limit_per_minute = Column(Integer, nullable=False, default=60)
    created_at = Column(DateTime, default=datetime.utcnow)
    usage_logs = relationship("ApiUsageLog", back_populates="api_key", cascade="all, delete-orphan")


class ApiUsageLog(Base):
    __tablename__ = "api_usage_logs"

    id = Column(CHAR(36), primary_key=True, default=gen_uuid)
    api_key_id = Column(CHAR(36), ForeignKey("api_keys.id", ondelete="CASCADE"), nullable=False, index=True)
    endpoint = Column(String(512), nullable=False)
    method = Column(String(10), nullable=False)
    status_code = Column(Integer, nullable=True)
    ip = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    api_key = relationship("ApiKey", back_populates="usage_logs")


class WrapperZohoRequest(Base):
    """
    Draft Zoho-shaped requests kept only in the wrapper until POST .../send.

    SignFlo auto-sends when a signing request is created while the template already has
    signature fields, so we defer backend POST /signing-requests until send.
    """

    __tablename__ = "wrapper_zoho_requests"

    wrapper_id = Column(CHAR(36), primary_key=True)
    file_id = Column(String(36), nullable=False, index=True)
    requests_json = Column(Text, nullable=False)
    backend_signing_request_id = Column(String(36), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
