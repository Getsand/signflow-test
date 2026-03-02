"""Public API router: mounts documents, requests, and API key management."""

from fastapi import APIRouter

from app.api.controllers import documents, requests, api_keys, templates, field_types, users

api_router = APIRouter(tags=["Public API"])


@api_router.get("", include_in_schema=True)
async def public_api_info():
    """Public API v1 summary. All endpoints under /api/v1 use API key auth (except auth and this info)."""
    return {
        "name": "SignFlo Public API",
        "version": "v1",
        "docs": "/docs",
        "openapi": "/openapi.json",
        "sections": {
            "auth": "POST /api/v1/auth/register, POST /api/v1/auth/login, POST /api/v1/auth/api-keys (JWT)",
            "api-keys": "POST/GET/DELETE /api/v1/api-keys (JWT); create key then use it as Bearer for below",
            "documents": "GET/POST /api/v1/documents, /documents/types, /documents/{id}, /documents/{id}/finalize (API key)",
            "templates": "GET/POST /api/v1/templates, /templates/presign, /templates/{id}, /templates/{id}/fields (API key)",
            "requests": "GET/POST /api/v1/requests, /api/v1/requests/stats, /api/v1/requests/{id}/send, /download (API key)",
            "field-types": "GET /api/v1/field-types (API key)",
            "users": "GET/POST/PUT/DELETE /api/v1/users, /users/me, /users/invite, /users/{id}/access, /users/{id}/role (API key)",
        },
        "auth": "API key in header: Authorization: Bearer <api_key> or ApiKey <api_key>",
        "rate_limit": "Per API key (default 60/min); set REDIS_URL for rate limiting.",
    }


api_router.include_router(documents.router)
api_router.include_router(templates.router)
api_router.include_router(requests.router)
api_router.include_router(field_types.router)
api_router.include_router(users.router)
api_router.include_router(api_keys.router)
