"""
API key hashing and generation. Keys are stored hashed; plain key shown only once on create.
"""
from __future__ import annotations

import hashlib
import secrets
from typing import Optional

from app.config import get_settings


def hash_api_key(plain_key: str) -> str:
    secret = get_settings().api_key_hash_secret
    return hashlib.sha256(f"{secret}:{plain_key}".encode()).hexdigest()


def generate_api_key(prefix: Optional[str] = None) -> tuple[str, str]:
    """Returns (plain_key, key_hash). Plain key should be shown once to the user."""
    prefix = prefix or get_settings().api_key_prefix
    random_part = secrets.token_urlsafe(32).replace("-", "").replace("_", "")[:32]
    plain_key = f"{prefix}{random_part}"
    return plain_key, hash_api_key(plain_key)


def key_prefix_for_display(plain_key: str) -> str:
    """Safe prefix for display (e.g. sf_live_abc...)."""
    if len(plain_key) <= 12:
        return plain_key
    return plain_key[:8] + "..." + plain_key[-4:]
