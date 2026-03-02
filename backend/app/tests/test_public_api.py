"""
Tests for the public API wrapper (API key auth, rate limiting, documents, requests).
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.core.db import get_db
from app.api.deps import _hash_key
from app.api.repo import ApiKeyRepository
from app.modules.auth.models import User
from app.modules.auth.repo import AuthRepository
from app.modules.auth.service import AuthService


pytestmark = pytest.mark.asyncio


async def _create_user_and_api_key(db: AsyncSession) -> tuple[User, str]:
    """Create a user and an API key; return (user, raw_api_key)."""
    auth_repo = AuthRepository(db)
    auth_service = AuthService(auth_repo)
    user = await auth_service.register_user(email="apiuser@test.com", password="testpass123")
    await db.flush()
    raw_key = "sk_live_test_key_12345"
    key_hash = _hash_key(raw_key)
    key_prefix = raw_key[:12] + "…"
    api_repo = ApiKeyRepository(db)
    await api_repo.create(
        key_hash=key_hash,
        key_prefix=key_prefix,
        owner_id=user.id,
        name="Test key",
        rate_limit_per_minute=60,
    )
    await db.commit()
    return user, raw_key


async def test_public_api_documents_requires_api_key(client: AsyncClient):
    """Without Authorization header, /api/v1/documents returns 401."""
    r = await client.get("/api/v1/documents")
    assert r.status_code == 401
    assert "invalid" in r.json().get("detail", "").lower() or "missing" in r.json().get("detail", "").lower()


async def test_public_api_requests_requires_api_key(client: AsyncClient):
    """Without Authorization header, /api/v1/requests returns 401."""
    r = await client.get("/api/v1/requests")
    assert r.status_code == 401


async def test_api_keys_requires_jwt(client: AsyncClient):
    """Without JWT, /api/v1/api-keys returns 401."""
    r = await client.get("/api/v1/api-keys")
    assert r.status_code == 401


async def test_public_api_list_documents_with_valid_key(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """With valid API key, GET /api/v1/documents returns 200 and standardized body."""
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    try:
        _, raw_key = await _create_user_and_api_key(db_session)
        r = await client.get(
            "/api/v1/documents",
            headers={"Authorization": f"Bearer {raw_key}"},
        )
        assert r.status_code == 200
        body = r.json()
        assert "code" in body
        assert "message" in body
        assert "data" in body
        assert body["code"] == 0
        assert body["data"] == []
    finally:
        app.dependency_overrides.clear()


async def test_public_api_invalid_key_returns_401(client: AsyncClient):
    """Invalid API key returns 401."""
    r = await client.get(
        "/api/v1/documents",
        headers={"Authorization": "Bearer sk_live_invalid_key"},
    )
    assert r.status_code == 401


async def test_public_api_accepts_apikey_scheme(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Authorization: ApiKey <key> is accepted like Bearer."""
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    try:
        _, raw_key = await _create_user_and_api_key(db_session)
        r = await client.get(
            "/api/v1/documents",
            headers={"Authorization": f"ApiKey {raw_key}"},
        )
        assert r.status_code == 200
        assert r.json().get("code") == 0
    finally:
        app.dependency_overrides.clear()


async def test_public_api_create_key_requires_jwt(client: AsyncClient):
    """POST /api/v1/api-keys without JWT returns 401."""
    r = await client.post(
        "/api/v1/api-keys",
        json={"name": "My key", "rate_limit_per_minute": 60},
    )
    assert r.status_code == 401


async def test_public_api_create_key_with_jwt(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """With JWT, user can create an API key and get it once in response."""
    async def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    try:
        auth_repo = AuthRepository(db_session)
        auth_service = AuthService(auth_repo)
        user = await auth_service.register_user(email="jwtuser@test.com", password="testpass123")
        await db_session.commit()
        from app.core.security import create_access_token
        token = create_access_token({"sub": str(user.id)})
        r = await client.post(
            "/api/v1/api-keys",
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Integration key", "rate_limit_per_minute": 100},
        )
        assert r.status_code == 201
        body = r.json()
        assert "api_key" in body
        assert body["api_key"].startswith("sk_live_")
        assert body.get("name") == "Integration key"
        assert body.get("rate_limit_per_minute") == 100
    finally:
        app.dependency_overrides.clear()
