# SignFlo Public API Wrapper – Complete & Working

This wrapper exposes a public API under `/api/v1` with **API key auth** and **rate limiting**. It reuses existing services (files, signing requests); no change to business logic or DB schema except `api_keys`, `api_usage_logs`, and optional user-management fields on `users` (invited_by_id, is_active, role).

---

## What’s included

| Layer | Location | Purpose |
|-------|----------|---------|
| **Models** | `app/api/models.py` | `ApiKey`, `ApiUsageLog` |
| **Repo** | `app/api/repo.py` | Create/list/revoke keys; usage logs |
| **Auth + rate limit** | `app/api/deps.py` | API key from header; Redis rate limit per key |
| **Schemas** | `app/api/schemas.py` | `ApiResponse`, request/response DTOs |
| **Controllers** | `app/api/controllers/` | documents, requests, api_keys |
| **Router** | `app/api/router.py` | Mounts all under `/api/v1` |
| **Main** | `app/main.py` | API keys router + full api_router under `/api/v1` |

---

## Endpoints (all under `/api/v1`) – Zoho Sign style

- **Auth (JWT):** register, login, create API key (also at `/api/v1/auth/api-keys`), list/revoke API keys.
- **Documents (API key):** list, **get document types**, presign (create document), get, **update (rename)**, finalize, delete, send for signature (via requests).
- **Templates (API key):** list templates, create (presign + finalize), get, update (rename), **add fields**, **list fields**; send for signature via `POST /requests` with `file_id`.
- **Field types (API key):** **GET /field-types** – retrieve supported field types (SIGNATURE, INITIAL, DATE, TEXT, etc.).
- **Users (API key):** **GET /users/me**, **GET /users**, **GET /users/{id}**, **POST /users/invite**, **PUT /users/{id}**, **PUT /users/{id}/access**, **PUT /users/{id}/role**, **DELETE /users/{id}** (Zoho Sign–style user management; requires migration that adds invited_by_id, is_active, role to users).
- **Requests (API key):** list, stats, create (from template), get, send, download signed PDF, delete.

*Folders and create document type are not implemented.*

Full list and Zoho mapping: **[PUBLIC_API.md](PUBLIC_API.md)**.

---

## Auth

- **JWT (for API keys):** `Authorization: Bearer <access_token>` (from Login).
- **API key (for documents/requests):** `Authorization: Bearer <api_key>` or `ApiKey <api_key>` (from Create API key).

---

## Rate limiting

- Per API key (default 60 requests/minute).
- **Requires** `REDIS_URL` in `.env`; if unset, rate limiting is skipped.

---

## Response format (documents & requests)

```json
{ "code": 0, "message": "success", "data": { ... } }
```

Errors: `code` ≠ 0, `message` with reason, `data` often `null`.

---

## Quick test

1. **Register:** `POST /api/v1/auth/register` with `{ "email": "...", "password": "..." }`.
2. **Login:** `POST /api/v1/auth/login` → copy `access_token`.
3. **Create API key:** `POST /api/v1/api-keys` (or `/api/v1/auth/api-keys`) with `Authorization: Bearer <access_token>`, body `{ "name": "Test", "rate_limit_per_minute": 60 }` → copy `api_key` (shown once).
4. **Call API:** e.g. `GET /api/v1/documents` with `Authorization: Bearer <api_key>`.

---

## Postman

Import **`postman/SignFlo_Public_API.postman_collection.json`**. Set `base_url` (e.g. `http://127.0.0.1:8000`). Run Auth → Login, then API Keys → Create API Key; use **Bearer Token** with `{{jwt_token}}`, not “JWT Bearer” with a secret.

---

## Docs

- **Swagger:** `http://127.0.0.1:8000/docs`
- **API summary:** `GET http://127.0.0.1:8000/api/v1`
